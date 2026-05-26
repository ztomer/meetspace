/**
 * After a session is captured + transcribed, optionally run local Pyannote
 * diarization on the saved audio file and merge the resulting speaker turns
 * into the transcript's `speaker_hints` column. The existing transcript UI
 * (`SpeakerLabelManager`) then shows Speaker 1 / Speaker 2 / … labels for
 * free.
 *
 * Off by default — controlled by the `diarize_auto` setting. Failures are
 * swallowed so a diarization hiccup never breaks the session-stop flow.
 */

import type { Store } from "tinybase/with-schemas";

import {
  commands as diarizeCommands,
  type SpeakerTurn,
} from "@meetspace/plugin-diarize";

type SpeakerHint = {
  wordIndex: number;
  data: {
    type: "provider_speaker_index";
    speaker_index: number;
    provider?: string;
  };
};

type TranscriptWord = {
  start_ms?: number;
  end_ms?: number;
  [key: string]: unknown;
};

export async function maybeDiarizeAndPersist(
  // biome-ignore lint/suspicious/noExplicitAny: tinybase generic
  mainStore: Store<any>,
  // biome-ignore lint/suspicious/noExplicitAny: tinybase generic
  settingsStore: Store<any>,
  sessionId: string,
  audioPath: string | null,
): Promise<void> {
  if (!audioPath) return;
  if (settingsStore.getValue("diarize_auto") !== true) return;

  let turns: SpeakerTurn[];
  try {
    const result = await diarizeCommands.diarizeAudio(audioPath);
    if (result.status === "error") {
      console.error("[diarize] failed", result.error);
      return;
    }
    turns = result.data;
  } catch (error) {
    console.error("[diarize] command threw", { sessionId, error });
    return;
  }

  if (turns.length === 0) return;

  // Find the transcript row for this session. There's typically one per
  // session; if more we pick the latest.
  let transcriptId: string | null = null;
  let latestStart = -1;
  mainStore.forEachRow("transcripts", (rowId: string, _forEachCell: unknown) => {
    if (mainStore.getCell("transcripts", rowId, "session_id") !== sessionId) return;
    const started = (mainStore.getCell("transcripts", rowId, "started_at") as number) ?? 0;
    if (started > latestStart) {
      latestStart = started;
      transcriptId = rowId;
    }
  });

  if (!transcriptId) {
    console.warn("[diarize] no transcript row for session", { sessionId });
    return;
  }

  // The words column is a JSON array of WordLike { start_ms, end_ms, … }.
  const wordsRaw = mainStore.getCell("transcripts", transcriptId, "words");
  if (typeof wordsRaw !== "string") return;
  let words: TranscriptWord[];
  try {
    words = JSON.parse(wordsRaw);
  } catch {
    return;
  }
  if (!Array.isArray(words) || words.length === 0) return;

  const hints: SpeakerHint[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (typeof w.start_ms !== "number" || typeof w.end_ms !== "number") continue;
    const mid = (w.start_ms + w.end_ms) / 2;
    const turn = turns.find((t) => mid >= t.startMs && mid <= t.endMs);
    if (!turn) continue;
    hints.push({
      wordIndex: i,
      data: {
        type: "provider_speaker_index",
        speaker_index: turn.speakerIndex,
        provider: "pyannote-local",
      },
    });
  }

  if (hints.length === 0) return;

  mainStore.setCell(
    "transcripts",
    transcriptId,
    "speaker_hints",
    JSON.stringify(hints),
  );
}
