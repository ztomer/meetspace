import { describe, expect, test } from "vitest";

import {
  canRunBatchTranscription,
  getBatchFallbackTarget,
  getBatchProvider,
  getSessionSpeakerCount,
} from "./useRunBatch";
import { useRunBatch } from "./useRunBatch";

const {
  startTranscriptionMock,
  useListenerMock,
  useSessionMock,
  useSessionParticipantsMock,
  useSTTConnectionMock,
  useAuthMock,
  useBillingAccessMock,
  useConfigValueMock,
  isSupportedLanguagesBatchMock,
  sonnerToastMessageMock,
  deleteProcessedAudioForRetentionMock,
  createTranscriptMock,
  appendTranscriptWordsAndHintsMock,
  idMock,
} = vi.hoisted(() => ({
  startTranscriptionMock: vi.fn(),
  useListenerMock: vi.fn(),
  useSessionMock: vi.fn(),
  useSessionParticipantsMock: vi.fn(),
  useSTTConnectionMock: vi.fn(),
  useAuthMock: vi.fn(),
  useBillingAccessMock: vi.fn(),
  useConfigValueMock: vi.fn(),
  isSupportedLanguagesBatchMock: vi.fn(),
  sonnerToastMessageMock: vi.fn(),
  deleteProcessedAudioForRetentionMock: vi.fn(),
  createTranscriptMock: vi.fn(),
  appendTranscriptWordsAndHintsMock: vi.fn(),
  idMock: vi.fn(),
}));

vi.mock("./contexts", () => ({
  useListener: useListenerMock,
}));

vi.mock("./useKeywords", () => ({
  getSessionKeywords: vi.fn(async () => []),
  useKeywords: vi.fn(() => []),
}));

vi.mock("./useSTTConnection", () => ({
  useSTTConnection: useSTTConnectionMock,
}));

vi.mock("@meetspace/ui/components/ui/toast", () => ({
  sonnerToast: {
    message: sonnerToastMessageMock,
  },
}));

vi.mock("~/auth", () => ({
  useAuth: useAuthMock,
}));

vi.mock("~/auth/billing-context", () => ({
  useBillingAccess: useBillingAccessMock,
}));

vi.mock("~/env", () => ({
  env: {
    VITE_API_URL: "https://api.test",
  },
}));

vi.mock("~/services/audio-retention", () => ({
  deleteProcessedAudioForRetention: deleteProcessedAudioForRetentionMock,
  normalizeAudioRetention: (value: unknown) =>
    typeof value === "string" ? value : "forever",
}));

vi.mock("~/session/queries", () => ({
  useSession: useSessionMock,
  useSessionParticipants: useSessionParticipantsMock,
}));

vi.mock("~/shared/config", () => ({
  useConfigValue: useConfigValueMock,
}));

vi.mock("~/shared/utils", () => ({
  id: idMock,
}));

vi.mock("~/stt/capabilities", () => {
  const baseLanguageCode = (language: string) =>
    language.split(/[-_]/)[0]?.toLowerCase() ?? "";

  return {
    getTranscriptionLanguages: (
      mainLanguage: string | null | undefined,
      spokenLanguages: readonly string[] | null | undefined,
    ) => {
      const seen = new Set<string>();
      const languages: string[] = [];

      for (const language of [mainLanguage, ...(spokenLanguages ?? [])]) {
        if (!language) {
          continue;
        }

        const baseCode = baseLanguageCode(language);
        if (!baseCode || seen.has(baseCode)) {
          continue;
        }

        seen.add(baseCode);
        languages.push(language);
      }

      return languages;
    },
    isSupportedLanguagesBatch: isSupportedLanguagesBatchMock,
  };
});

vi.mock("~/stt/queries", () => ({
  appendTranscriptWordsAndHints: appendTranscriptWordsAndHintsMock,
  createTranscript: createTranscriptMock,
}));

describe("getBatchProvider", () => {
  test("maps pyannote to the batch transcription provider", () => {
    expect(getBatchProvider("pyannote", "parakeet-tdt-0.6b-v3")).toBe(
      "pyannote",
    );
  });

  test("keeps openai mapped to the batch transcription provider", () => {
    expect(getBatchProvider("openai", "gpt-4o-transcribe")).toBe("openai");
  });

  test("maps Cloudflare Workers AI to the Deepgram-compatible batch provider", () => {
    expect(getBatchProvider("cloudflare_workers_ai", "nova-3")).toBe(
      "deepgram",
    );
  });

  test("maps local soniqo models to soniqo batch provider", () => {
    expect(getBatchProvider("meetspace", "soniqo-parakeet-batch")).toBe(
      "soniqo",
    );
  });
});

describe("getSessionSpeakerCount", () => {
  test("counts distinct session participants plus the current user", () => {
    const rows = new Map([
      ["mapping-1", { session_id: "session-1", human_id: "human-a" }],
      ["mapping-2", { session_id: "session-1", human_id: "human-a" }],
      ["mapping-3", { session_id: "session-1", human_id: "human-b" }],
      ["mapping-4", { session_id: "other-session", human_id: "human-c" }],
    ]);
    const store = {
      forEachRow: (_table: string, callback: (rowId: string) => void) => {
        for (const rowId of rows.keys()) callback(rowId);
      },
      getCell: (_table: string, rowId: string, cellId: string) =>
        rows.get(rowId)?.[cellId as "session_id" | "human_id"],
    };

    expect(getSessionSpeakerCount(store as any, "session-1", "self")).toBe(3);
  });

  test("returns undefined until at least two speakers are known", () => {
    const rows = new Map([
      ["mapping-1", { session_id: "session-1", human_id: "human-a" }],
    ]);
    const store = {
      forEachRow: (_table: string, callback: (rowId: string) => void) => {
        for (const rowId of rows.keys()) callback(rowId);
      },
      getCell: (_table: string, rowId: string, cellId: string) =>
        rows.get(rowId)?.[cellId as "session_id" | "human_id"],
    };

    expect(getSessionSpeakerCount(store as any, "session-1", null)).toBe(
      undefined,
    );
  });
});
