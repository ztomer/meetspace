import { useMemo } from "react";

import type { RenderTranscriptRequest } from "@meetspace/plugin-transcription";

import {
  useSessionParticipantHumanIds,
  useSessionTranscripts,
  useTranscript,
  useTranscriptHumans,
} from "~/stt/queries";
import {
  buildRenderTranscriptRequestFromRows,
  collectAssignedHumanIdsFromTranscriptRows,
  type RenderTranscriptRequestHumans,
  type TranscriptRow,
} from "~/stt/render-transcript";

export type TranscriptRowWithId = {
  transcriptId: string;
  row: TranscriptRow;
};

function getUniqueRowIds(rowIds: readonly string[]): string[] {
  const uniqueRowIds: string[] = [];
  const seen = new Set<string>();

  for (const rowId of rowIds) {
    if (!rowId || seen.has(rowId)) {
      continue;
    }

    uniqueRowIds.push(rowId);
    seen.add(rowId);
  }

  return uniqueRowIds;
}

function mapTranscriptToRow(transcript: {
  id: string;
  startedAt: number;
  words: TranscriptRow["words"];
  speakerHints: TranscriptRow["speaker_hints"];
}): TranscriptRow {
  return {
    started_at: transcript.startedAt,
    words: transcript.words,
    speaker_hints: transcript.speakerHints,
  };
}

export function useTranscriptRenderData(transcriptId: string): {
  request: RenderTranscriptRequest | null;
  transcriptRows: TranscriptRowWithId[];
} {
  const transcript = useTranscript(transcriptId);
  const transcriptRow = transcript ? mapTranscriptToRow(transcript) : null;
  const transcriptRows: TranscriptRowWithId[] = transcript
    ? [{ transcriptId, row: transcriptRow! }]
    : [];

  const sessionId = transcript?.sessionId ?? "";
  const participantHumanIds = useSessionParticipantHumanIds(sessionId);
  const assignedHumanIds = useMemo(
    () =>
      transcriptRows.length > 0
        ? collectAssignedHumanIdsFromTranscriptRows(
            transcriptRows.map((tr) => tr.row),
          )
        : [],
    [transcriptRows],
  );
  const humanIds = useMemo(
    () =>
      getUniqueRowIds([
        ...participantHumanIds,
        ...assignedHumanIds,
        transcript?.ownerUserId ?? "",
      ]),
    [assignedHumanIds, participantHumanIds, transcript?.ownerUserId],
  );
  const humans = useTranscriptHumans(humanIds);

  const selfHumanId = transcript?.ownerUserId;

  const request = useMemo(() => {
    if (transcriptRows.length === 0) return null;

    const humansData: RenderTranscriptRequestHumans | undefined = humans
      ? { selfHumanId, humans }
      : undefined;

    return buildRenderTranscriptRequestFromRows(
      transcriptRows.map((tr) => tr.row),
      humansData,
      participantHumanIds,
    );
  }, [transcriptRows, humans, selfHumanId, participantHumanIds]);

  return { request, transcriptRows };
}

export function useSessionTranscriptRenderData(sessionId: string): {
  request: RenderTranscriptRequest | null;
  transcriptRows: TranscriptRowWithId[];
} {
  const transcripts = useSessionTranscripts(sessionId);
  const participantHumanIds = useSessionParticipantHumanIds(sessionId);

  const transcriptRows: TranscriptRowWithId[] = useMemo(
    () =>
      transcripts.map((t) => ({
        transcriptId: t.id,
        row: mapTranscriptToRow(t),
      })),
    [transcripts],
  );

  const assignedHumanIds = useMemo(
    () =>
      transcriptRows.length > 0
        ? collectAssignedHumanIdsFromTranscriptRows(
            transcriptRows.map((tr) => tr.row),
          )
        : [],
    [transcriptRows],
  );

  const selfHumanId = transcripts[0]?.ownerUserId ?? "";

  const humanIds = useMemo(
    () =>
      getUniqueRowIds([
        ...participantHumanIds,
        ...assignedHumanIds,
        selfHumanId,
      ]),
    [assignedHumanIds, participantHumanIds, selfHumanId],
  );
  const humans = useTranscriptHumans(humanIds);

  const request = useMemo(() => {
    if (transcriptRows.length === 0) return null;

    const humansData: RenderTranscriptRequestHumans | undefined = humans
      ? { selfHumanId: selfHumanId || undefined, humans }
      : undefined;

    return buildRenderTranscriptRequestFromRows(
      transcriptRows.map((tr) => tr.row),
      humansData,
      participantHumanIds,
    );
  }, [transcriptRows, humans, selfHumanId, participantHumanIds]);

  return { request, transcriptRows };
}
