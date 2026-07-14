import { useMutation } from "@tanstack/react-query";
import { downloadDir, join } from "@tauri-apps/api/path";
import { FileTextIcon, Loader2Icon } from "lucide-react";
import { useMemo } from "react";

import { json2md } from "@meetspace/editor/markdown";
import { commands as analyticsCommands } from "@meetspace/plugin-analytics";
import {
  commands as exportCommands,
  type ExportMetadata,
  type TranscriptItem,
} from "@meetspace/plugin-export";
import { commands as openerCommands } from "@meetspace/plugin-opener2";
import { DropdownMenuItem } from "@meetspace/ui/components/ui/dropdown-menu";

import { formatDate, formatDuration } from "./export-utils";

import {
  useSession,
  useSessionParticipants,
  useEnhancedNote,
} from "~/session/queries";
import { getSessionEvent } from "~/session/utils";
import type { EditorView } from "~/store/zustand/tabs/schema";
import { useSessionTranscripts } from "~/stt/queries";

export function ExportPDF({
  sessionId,
  currentView,
}: {
  sessionId: string;
  currentView: EditorView;
}) {
  const session = useSession(sessionId);
  const sessionTitle = session?.title;
  const sessionCreatedAt = session?.created_at;
  const event = session ? getSessionEvent(session) : null;
  const eventTitle = event?.title;

  const rawMd = session?.raw_md;

  const enhancedNoteId = currentView.type === "enhanced" ? currentView.id : "";
  const enhancedNote = useEnhancedNote(enhancedNoteId);
  const enhancedNoteContent = enhancedNote?.content;

  const participants = useSessionParticipants(sessionId);
  const participantNames = useMemo((): string[] => {
    return participants.map((p) => p.name).filter(Boolean);
  }, [participants]);

  const transcripts = useSessionTranscripts(sessionId);

  const transcriptDuration = useMemo((): string | null => {
    if (transcripts.length === 0) {
      return null;
    }

    let minStartedAt: number | null = null;
    let maxEndedAt: number | null = null;

    for (const transcript of transcripts) {
      const startedAt = transcript.startedAt;
      const endedAt = transcript.endedAt;

      if (typeof startedAt === "number") {
        if (minStartedAt === null || startedAt < minStartedAt) {
          minStartedAt = startedAt;
        }
      }
      if (typeof endedAt === "number") {
        if (maxEndedAt === null || endedAt > maxEndedAt) {
          maxEndedAt = endedAt;
        }
      }
    }

    if (minStartedAt !== null && maxEndedAt !== null) {
      return formatDuration(minStartedAt, maxEndedAt);
    }
    return null;
  }, [transcripts]);

  const getExportContent = useMemo(() => {
    return (): {
      enhancedMd: string;
      memoMd: string | null;
      transcript: { items: TranscriptItem[] } | null;
      metadata: ExportMetadata | null;
    } => {
      const metadata: ExportMetadata = {
        title: sessionTitle || "Untitled",
        createdAt: sessionCreatedAt ? formatDate(sessionCreatedAt) : "",
        participants: participantNames,
        eventTitle: eventTitle || null,
        duration: transcriptDuration,
      };

      switch (currentView.type) {
        case "raw": {
          let memoMd = "";
          if (rawMd) {
            try {
              const parsed = JSON.parse(rawMd);
              memoMd = json2md(parsed);
            } catch {
              memoMd = "";
            }
          }
          return {
            enhancedMd: "",
            memoMd,
            transcript: null,
            metadata,
          };
        }
        case "enhanced": {
          let enhancedMd = "";
          if (enhancedNoteContent) {
            try {
              const parsed = JSON.parse(enhancedNoteContent);
              enhancedMd = json2md(parsed);
            } catch {
              enhancedMd = "";
            }
          }
          return {
            enhancedMd,
            memoMd: null,
            transcript: null,
            metadata,
          };
        }
        default:
          return {
            enhancedMd: "",
            memoMd: null,
            transcript: null,
            metadata,
          };
      }
    };
  }, [
    currentView,
    rawMd,
    enhancedNoteContent,
    sessionTitle,
    sessionCreatedAt,
    participantNames,
    eventTitle,
    transcriptDuration,
  ]);

  const getExportLabel = () => {
    switch (currentView.type) {
      case "raw":
        return "Export Memo to PDF";
      case "enhanced":
        return "Export Summary to PDF";
      default:
        return "Export to PDF";
    }
  };

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const downloadsPath = await downloadDir();
      const sanitizedTitle = (
        (sessionTitle ?? "Untitled").trim() || "Untitled"
      ).replace(/[<>:"/\\|?*]/g, "_");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `${sanitizedTitle}_${timestamp}.pdf`;
      const path = await join(downloadsPath, filename);

      const exportContent = getExportContent();
      const result = await exportCommands.export(path, exportContent);

      if (result.status === "error") {
        throw new Error(result.error);
      }

      return path;
    },
    onSuccess: (path) => {
      if (path) {
        void analyticsCommands.event({
          event: "session_exported",
          format: "pdf",
          view_type: currentView.type,
          has_transcript: false,
          has_enhanced:
            currentView.type === "enhanced" && !!enhancedNoteContent,
          has_memo: currentView.type === "raw" && !!rawMd,
        });
        void openerCommands.revealItemInDir(path);
      }
    },
    onError: console.error,
  });

  return (
    <DropdownMenuItem
      onClick={(e) => {
        e.preventDefault();
        void mutate(null);
      }}
      disabled={isPending}
      className="cursor-pointer"
    >
      {isPending ? <Loader2Icon className="animate-spin" /> : <FileTextIcon />}
      <span>{isPending ? "Exporting..." : getExportLabel()}</span>
    </DropdownMenuItem>
  );
}
