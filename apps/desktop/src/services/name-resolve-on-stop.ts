/**
 * Phase 9.2: after diarization fills `Speaker N` labels, ask the configured
 * LLM to map each speaker index to a known participant (human_id) using the
 * transcript text + the session's participant roster.
 *
 * Pure post-processing. Off implicitly when no LLM is configured. Failures
 * are logged not thrown.
 */

import { generateText, type wrapLanguageModel } from "ai";

import type { Store } from "tinybase/with-schemas";

// Mirror the type alias from useLLMConnection.ts — the ai SDK doesn't
// re-export it cleanly so we derive from wrapLanguageModel's input type.
type LanguageModel = Parameters<typeof wrapLanguageModel>[0]["model"];

type ProviderSpeakerHint = {
  wordIndex: number;
  data: {
    type: "provider_speaker_index";
    speaker_index: number;
    provider?: string;
  };
};
type UserSpeakerHint = {
  wordIndex: number;
  data: { type: "user_speaker_assignment"; human_id: string };
};
type SpeakerHint = ProviderSpeakerHint | UserSpeakerHint;

type TranscriptWord = {
  text?: string;
  start_ms?: number;
  end_ms?: number;
};

type Participant = { human_id: string; name: string };

export async function maybeResolveSpeakerNames(
  // biome-ignore lint/suspicious/noExplicitAny: tinybase generic
  mainStore: Store<any>,
  sessionId: string,
  model: LanguageModel | null,
): Promise<void> {
  if (!model) return;

  // Locate the latest transcript row for this session.
  let transcriptId: string | null = null;
  let latestStart = -1;
  mainStore.forEachRow(
    "transcripts",
    (rowId: string, _forEachCell: unknown) => {
      if (mainStore.getCell("transcripts", rowId, "session_id") !== sessionId)
        return;
      const started =
        (mainStore.getCell("transcripts", rowId, "started_at") as number) ?? 0;
      if (started > latestStart) {
        latestStart = started;
        transcriptId = rowId;
      }
    },
  );
  if (!transcriptId) return;

  const hintsRaw = mainStore.getCell("transcripts", transcriptId, "speaker_hints");
  const wordsRaw = mainStore.getCell("transcripts", transcriptId, "words");
  if (typeof hintsRaw !== "string" || typeof wordsRaw !== "string") return;

  let hints: SpeakerHint[];
  let words: TranscriptWord[];
  try {
    hints = JSON.parse(hintsRaw);
    words = JSON.parse(wordsRaw);
  } catch {
    return;
  }
  if (!Array.isArray(hints) || hints.length === 0) return;
  if (!Array.isArray(words) || words.length === 0) return;

  const providerHints = hints.filter(
    (h): h is ProviderSpeakerHint => h.data?.type === "provider_speaker_index",
  );
  if (providerHints.length === 0) return;
  const presentSpeakers = Array.from(
    new Set(providerHints.map((h) => h.data.speaker_index)),
  );
  if (presentSpeakers.length === 0) return;
  if (presentSpeakers.length === 1) return; // single speaker — nothing to disambiguate

  // Pull the participant roster.
  const participants: Participant[] = [];
  mainStore.forEachRow(
    "mapping_session_participant",
    (mappingId: string, _forEachCell: unknown) => {
      if (
        mainStore.getCell(
          "mapping_session_participant",
          mappingId,
          "session_id",
        ) !== sessionId
      )
        return;
      const humanId = mainStore.getCell(
        "mapping_session_participant",
        mappingId,
        "human_id",
      );
      if (typeof humanId !== "string" || !humanId) return;
      const name = mainStore.getCell("humans", humanId, "name");
      if (typeof name !== "string" || !name) return;
      participants.push({ human_id: humanId, name });
    },
  );
  if (participants.length === 0) return; // no roster to map onto

  // Build a transcript view with speaker tags. Group consecutive words by
  // the speaker we currently assigned and emit short lines, keeping payload
  // bounded.
  const wordSpeaker = new Map<number, number>();
  for (const h of providerHints) wordSpeaker.set(h.wordIndex, h.data.speaker_index);

  const lines: string[] = [];
  let buf: string[] = [];
  let currentSpeaker: number | null = null;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const text = (w.text ?? "").toString().trim();
    if (!text) continue;
    const sp = wordSpeaker.get(i);
    if (sp === undefined) continue;
    if (sp !== currentSpeaker) {
      if (buf.length > 0 && currentSpeaker !== null) {
        lines.push(`Speaker ${currentSpeaker + 1}: ${buf.join(" ")}`);
      }
      buf = [];
      currentSpeaker = sp;
    }
    buf.push(text);
  }
  if (buf.length > 0 && currentSpeaker !== null) {
    lines.push(`Speaker ${currentSpeaker + 1}: ${buf.join(" ")}`);
  }
  const transcript = truncate(lines.join("\n"), 8000);

  const knownNames = participants.map((p) => `- ${p.name} (id: ${p.human_id})`);
  const speakerList = presentSpeakers.map((s) => `Speaker ${s + 1}`).join(", ");

  const system = `You map anonymous speaker labels in a meeting transcript to known participants.
Reply with ONLY a JSON object of the shape { "Speaker N": "<human_id>" | null }.
Use null when uncertain. Do not invent ids; only use ids from the provided roster.`;

  const prompt = `Participants in this meeting:
${knownNames.join("\n")}

Anonymous speakers present: ${speakerList}

Transcript:
${transcript}

Reply with the JSON mapping now. No other text.`;

  let raw: string;
  try {
    const result = await generateText({
      model,
      system,
      prompt,
      temperature: 0,
    });
    raw = result.text;
  } catch (error) {
    console.error("[name-resolve] LLM call failed", { sessionId, error });
    return;
  }

  const mapping = parseMapping(raw);
  if (!mapping) {
    console.warn("[name-resolve] could not parse LLM reply", { sessionId, raw });
    return;
  }

  const validIds = new Set(participants.map((p) => p.human_id));
  const resolved = new Map<number, string>();
  for (const [key, value] of Object.entries(mapping)) {
    if (!value || typeof value !== "string") continue;
    if (!validIds.has(value)) continue;
    const m = /^speaker\s+(\d+)$/i.exec(key.trim());
    if (!m) continue;
    const speakerIndex = parseInt(m[1], 10) - 1;
    if (speakerIndex < 0) continue;
    resolved.set(speakerIndex, value);
  }

  if (resolved.size === 0) return;

  // Rewrite hints: provider hints whose speaker_index resolved become
  // user_speaker_assignment hints; others (and non-provider hints) pass
  // through unchanged.
  const next: SpeakerHint[] = hints.map((h) => {
    if (h.data.type !== "provider_speaker_index") return h;
    const humanId = resolved.get(h.data.speaker_index);
    if (!humanId) return h;
    return {
      wordIndex: h.wordIndex,
      data: { type: "user_speaker_assignment", human_id: humanId },
    };
  });

  mainStore.setCell(
    "transcripts",
    transcriptId,
    "speaker_hints",
    JSON.stringify(next),
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n…[truncated for context budget]…`;
}

/** Extract the first JSON object from a possibly-noisy LLM reply. */
function parseMapping(raw: string): Record<string, string | null> | null {
  // Direct parse first.
  try {
    return JSON.parse(raw) as Record<string, string | null>;
  } catch {}
  // Try a fenced block or any { … } match.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)```/);
  const inner = fenced?.[1] ?? raw;
  const braceMatch = inner.match(/\{[\s\S]*\}/);
  if (!braceMatch) return null;
  try {
    return JSON.parse(braceMatch[0]) as Record<string, string | null>;
  } catch {
    return null;
  }
}
