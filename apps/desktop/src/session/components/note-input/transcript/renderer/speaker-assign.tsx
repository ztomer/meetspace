import { useCallback, useMemo, useState } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@meetspace/ui/components/ui/popover";
import { AppFloatingPanel } from "@meetspace/ui/components/ui/popover";
import { cn } from "@meetspace/utils";

import { useHumans } from "~/contacts/queries";
import { executeTransaction } from "~/db";
import { useSessionParticipants } from "~/session/queries";
import type { Segment } from "~/stt/live-segment";
import { useSessionParticipantHumanIds, useTranscript } from "~/stt/queries";

export function SpeakerAssignPopover({
  segment,
  transcriptId,
  color,
  label,
}: {
  segment: Segment;
  transcriptId: string;
  color: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const isSelf = segment.key.channel === "DirectMic";
  const transcript = useTranscript(transcriptId);
  const sessionId = transcript?.sessionId;

  const handleAssign = useCallback(
    async (humanId: string) => {
      if (!transcript || segment.words.length === 0) return;
      const anchorWordId = getAssignmentAnchorWordId(segment);
      if (!anchorWordId) return;
      const { assignTranscriptSpeaker } = await import("~/stt/queries");
      await assignTranscriptSpeaker({
        transcriptId,
        segmentKey: segment.key,
        humanId,
        anchorWordId,
      });
      setOpen(false);
    },
    [transcript, segment.key, segment.words, transcriptId],
  );

  if (isSelf) {
    return <span style={{ color }}>{label}</span>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn([
            "-ml-1 cursor-pointer rounded-xs px-1",
            "hover:bg-accent transition-colors",
          ])}
          style={{ color }}
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent variant="app" align="start" className="w-64">
        <ParticipantList sessionId={sessionId} onSelect={handleAssign} />
      </PopoverContent>
    </Popover>
  );
}

export function getAssignmentAnchorWordId(
  segment: Segment,
): string | undefined {
  const word = segment.words.find(
    (word) => typeof word.id === "string" && word.id.length > 0,
  );
  return typeof word?.id === "string" ? word.id : undefined;
}

export type SpeakerParticipantOption = {
  id: string;
  name: string;
  email?: string;
  isSessionParticipant: boolean;
  isNew?: boolean;
};

export function buildSpeakerParticipantGroups({
  sessionParticipants,
  contacts,
  query,
}: {
  sessionParticipants: SpeakerParticipantOption[];
  contacts: SpeakerParticipantOption[];
  query: string;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const matches = (option: SpeakerParticipantOption) => {
    if (!normalizedQuery) {
      return true;
    }

    return [option.name, option.email ?? ""].some((value) =>
      value.toLowerCase().includes(normalizedQuery),
    );
  };

  const sessionParticipantIds = new Set(
    sessionParticipants.map((option) => option.id),
  );
  const matchingSessionParticipants = sessionParticipants.filter(matches);
  const matchingContacts = contacts
    .filter((option) => !sessionParticipantIds.has(option.id))
    .filter(matches);

  return [
    ...(matchingSessionParticipants.length > 0
      ? [
          {
            title: "Session participants",
            options: matchingSessionParticipants,
          },
        ]
      : []),
    ...(matchingContacts.length > 0
      ? [
          {
            title: "Contacts",
            options: matchingContacts,
          },
        ]
      : []),
  ];
}

export function buildCreateSpeakerParticipantOption({
  query,
  existingOptions,
}: {
  query: string;
  existingOptions: SpeakerParticipantOption[];
}): SpeakerParticipantOption | null {
  const name = query.trim();
  if (!name) {
    return null;
  }

  const normalizedName = name.toLowerCase();
  const alreadyExists = existingOptions.some((option) =>
    [option.name, option.email ?? ""].some(
      (value) => value.toLowerCase() === normalizedName,
    ),
  );
  if (alreadyExists) {
    return null;
  }

  return {
    id: "new",
    name,
    isSessionParticipant: false,
    isNew: true,
  };
}

function ParticipantList({
  sessionId,
  onSelect,
}: {
  sessionId: string | undefined;
  onSelect: (humanId: string) => void;
}) {
  const allHumans = useHumans();
  const sessionParticipants = useSessionParticipants(sessionId ?? "");
  const participantHumanIds = useSessionParticipantHumanIds(sessionId ?? "");

  const [query, setQuery] = useState("");

  const participantIds = useMemo(
    () => new Set(participantHumanIds),
    [participantHumanIds],
  );

  const participants = useMemo(
    () =>
      sessionParticipants.map(
        (p): SpeakerParticipantOption => ({
          id: p.humanId,
          name: p.name || p.email || "Unknown",
          email: p.email || undefined,
          isSessionParticipant: true,
        }),
      ),
    [sessionParticipants],
  );

  const contacts = useMemo(() => {
    return allHumans
      .map((human): SpeakerParticipantOption | null => {
        const name = (human.name || "").trim();
        const email = (human.email || "").trim();
        if (!name && !email) {
          return null;
        }

        return {
          id: human.id,
          name: name || email,
          email: email || undefined,
          isSessionParticipant: false,
        };
      })
      .filter((p): p is SpeakerParticipantOption => p !== null);
  }, [allHumans]);

  const groups = useMemo(
    () =>
      buildSpeakerParticipantGroups({
        sessionParticipants: participants,
        contacts,
        query,
      }),
    [contacts, participants, query],
  );

  const createOption = useMemo(
    () =>
      buildCreateSpeakerParticipantOption({
        query,
        existingOptions: [...participants, ...contacts],
      }),
    [contacts, participants, query],
  );

  const linkHumanToSession = useCallback(
    async (humanId: string) => {
      if (!sessionId || participantIds.has(humanId)) {
        return;
      }

      const now = new Date().toISOString();
      await executeTransaction([
        {
          sql: `
            INSERT INTO session_participants (
              id, workspace_id, owner_user_id, session_id, human_id,
              display_name, email, role, source, metadata_json, created_at,
              updated_at, deleted_at
            )
            SELECT ?, session.workspace_id, session.owner_user_id, session.id, ?,
              human.name, human.email, '', 'manual', '{}', ?, ?, NULL
            FROM sessions AS session
            JOIN humans AS human ON human.id = ? AND human.deleted_at IS NULL
            WHERE session.id = ?
              AND session.deleted_at IS NULL
              AND NOT EXISTS (
                SELECT 1
                FROM session_participants AS existing
                WHERE existing.session_id = session.id
                  AND existing.human_id = ?
                  AND existing.deleted_at IS NULL
              )
          `,
          params: [
            crypto.randomUUID(),
            humanId,
            now,
            now,
            humanId,
            sessionId,
            humanId,
          ],
        },
      ]);
    },
    [participantIds, sessionId],
  );

  const createHuman = useCallback(
    async (name: string) => {
      const humanId = crypto.randomUUID();
      const now = new Date().toISOString();
      await executeTransaction([
        {
          sql: `
            INSERT INTO humans (
              id, workspace_id, owner_user_id, name, email, phone,
              job_title, linkedin_username, organization_id, memo,
              pinned, pin_order, created_at, updated_at, deleted_at
            )
            SELECT ?, session.workspace_id, session.owner_user_id, ?, '', '',
              '', '', '', '', false, 0, ?, ?, NULL
            FROM sessions AS session
            WHERE session.id = ? AND session.deleted_at IS NULL
              AND NOT EXISTS (
                SELECT 1
                FROM humans
                WHERE id = ?
              )
          `,
          params: [humanId, name, now, now, sessionId, humanId],
        },
      ]);
      return humanId;
    },
    [sessionId],
  );

  const handleSelect = useCallback(
    async (option: SpeakerParticipantOption) => {
      const humanId = option.isNew ? await createHuman(option.name) : option.id;
      if (!humanId) {
        return;
      }

      await linkHumanToSession(humanId);
      onSelect(humanId);
    },
    [createHuman, linkHumanToSession, onSelect],
  );

  return (
    <AppFloatingPanel className="overflow-hidden">
      <div className="border-border border-b p-2">
        <input
          autoFocus
          type="search"
          className={cn([
            "border-border bg-card h-8 w-full rounded-md border px-2 text-sm outline-hidden",
            "placeholder:text-muted-foreground focus:border-border",
          ])}
          placeholder="Search contacts"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="max-h-56 overflow-auto py-1">
        {createOption && (
          <ParticipantOptionButton
            option={createOption}
            onSelect={handleSelect}
          />
        )}

        {groups.map((group) => (
          <div key={group.title}>
            <div className="text-muted-foreground px-3 pt-2 pb-1 text-[11px] font-medium uppercase">
              {group.title}
            </div>
            {group.options.map((option) => (
              <ParticipantOptionButton
                key={option.id}
                option={option}
                onSelect={handleSelect}
              />
            ))}
          </div>
        ))}

        {!createOption && groups.length === 0 && (
          <p className="text-muted-foreground px-3 py-2 text-xs">
            {query.trim() ? "No matching contacts" : "No contacts"}
          </p>
        )}
      </div>
    </AppFloatingPanel>
  );
}

function ParticipantOptionButton({
  option,
  onSelect,
}: {
  option: SpeakerParticipantOption;
  onSelect: (option: SpeakerParticipantOption) => void;
}) {
  return (
    <button
      type="button"
      className={cn([
        "w-full px-3 py-1.5 text-left text-sm",
        "hover:bg-accent",
      ])}
      onClick={() => onSelect(option)}
    >
      <span className="block truncate">
        {option.isNew ? `Add "${option.name}"` : option.name}
      </span>
      {!option.isNew && option.email && (
        <span className="text-muted-foreground block truncate text-xs">
          {option.email}
        </span>
      )}
    </button>
  );
}
