import { describe, expect, test } from "vitest";

<<<<<<< HEAD
import {
  getDefaultSttModel,
  getDefaultSttSelection,
  getLanguageSupportIssue,
  getPreferredProviderModel,
  resolveLiveLanguageSupportMode,
} from "./selection";

describe("getDefaultSttModel", () => {
  test("repairs external providers with their first supported model", () => {
    expect(getDefaultSttModel("deepgram")).toBe("nova-3-general");
    expect(getDefaultSttModel("soniox")).toBe("stt-rt-v5");
  });

  test("does not invent a model for custom or Meetspace providers", () => {
    expect(getDefaultSttModel("custom")).toBeUndefined();
    expect(getDefaultSttModel("meetspace")).toBeUndefined();
  });
});
||||||| parent of 9ff709349 (chore: sync local-first fork changes before rebase)
import {
  getDefaultSttModel,
  getPreferredProviderModel,
  resolveLiveLanguageSupportMode,
} from "./selection";

describe("getDefaultSttModel", () => {
  test("repairs external providers with their first supported model", () => {
    expect(getDefaultSttModel("deepgram")).toBe("nova-3-general");
    expect(getDefaultSttModel("soniox")).toBe("stt-rt-v5");
  });

  test("does not invent a model for custom or Meetspace providers", () => {
    expect(getDefaultSttModel("custom")).toBeUndefined();
    expect(getDefaultSttModel("meetspace")).toBeUndefined();
  });
});
=======
import { getPreferredProviderModel } from "./selection";
>>>>>>> 9ff709349 (chore: sync local-first fork changes before rebase)

describe("getPreferredProviderModel", () => {
  test("returns the remembered model when it is still available", () => {
    expect(
      getPreferredProviderModel("nova-2-meeting", [
        { id: "nova-3-general" },
        { id: "nova-2-meeting" },
      ]),
    ).toBe("nova-2-meeting");
  });

  test("falls back to the first available model when none is remembered", () => {
    expect(
      getPreferredProviderModel(undefined, [
        { id: "stt-v4" },
        { id: "stt-v3" },
      ]),
    ).toBe("stt-v4");
  });

  test("falls back to the first available model when the remembered model is gone", () => {
    expect(
      getPreferredProviderModel("nova-2-meeting", [
        { id: "nova-3-general" },
        { id: "nova-2-general" },
      ]),
    ).toBe("nova-3-general");
  });

  test("skips models that are not selectable", () => {
    expect(
      getPreferredProviderModel(undefined, [
        { id: "cloud", isDownloaded: false },
        { id: "soniqo-qwen3-small", isDownloaded: true },
      ]),
    ).toBe("soniqo-qwen3-small");
  });

  test("can keep a saved model visible even when it is not selectable", () => {
    expect(
      getPreferredProviderModel(
        "cloud",
        [
          { id: "cloud", isDownloaded: false },
          { id: "soniqo-parakeet-streaming", isDownloaded: true },
        ],
        { keepUnavailableSavedModel: true },
      ),
    ).toBe("cloud");
  });

  test("clears the selection when a provider has no selectable models", () => {
    expect(
      getPreferredProviderModel("cloud", [
        { id: "cloud", isDownloaded: false },
      ]),
    ).toBe("");
  });

  test("migrates AssemblyAI universal to universal-3-pro when available", () => {
    expect(
      getPreferredProviderModel("universal", [
        { id: "universal-3-pro" },
        { id: "universal-2" },
      ]),
    ).toBe("universal-3-pro");
  });

  test("keeps the remembered value when the provider does not expose a static list", () => {
    expect(
      getPreferredProviderModel("whisper-large-v3", [], {
        allowSavedModelWithoutChoices: true,
      }),
    ).toBe("whisper-large-v3");
  });
});
<<<<<<< HEAD

describe("getDefaultSttSelection", () => {
  test("keeps the active configured provider and repairs its missing model", () => {
    expect(
      getDefaultSttSelection(
        ["deepgram", "assemblyai"],
        {
          deepgram: {
            configured: true,
            models: [{ id: "nova-3-general" }],
          },
          assemblyai: {
            configured: true,
            models: [{ id: "universal-3-pro" }],
          },
        },
        "deepgram",
      ),
    ).toEqual({ provider: "deepgram", model: "nova-3-general" });
  });

  test("skips configured providers that have no available model", () => {
    expect(
      getDefaultSttSelection(["meetspace", "deepgram"], {
        meetspace: {
          configured: true,
          models: [{ id: "cloud", isDownloaded: false }],
        },
        deepgram: {
          configured: true,
          models: [{ id: "nova-3-general" }],
        },
      }),
    ).toEqual({ provider: "deepgram", model: "nova-3-general" });
  });

  test("returns no selection when nothing is available", () => {
    expect(
      getDefaultSttSelection(["meetspace"], {
        meetspace: {
          configured: true,
          models: [{ id: "cloud", isDownloaded: false }],
        },
      }),
    ).toBeNull();
  });
});

describe("getLanguageSupportIssue", () => {
  test("returns the languages the model cannot transcribe", async () => {
    const issue = await getLanguageSupportIssue(
      ["en", "ko", "ja"],
      async (languages) => !languages.includes("ko"),
    );

    expect(issue).toEqual({ unsupportedLanguages: ["ko"] });
  });

  test("distinguishes an unsupported combination from unsupported languages", async () => {
    const issue = await getLanguageSupportIssue(
      ["en", "ko"],
      async (languages) => languages.length === 1,
    );

    expect(issue).toEqual({ unsupportedLanguages: [] });
  });

  test("returns no issue when the full selection is supported", async () => {
    const issue = await getLanguageSupportIssue(["en", "ko"], async () => true);

    expect(issue).toBeNull();
  });
});

describe("resolveLiveLanguageSupportMode", () => {
  test("uses provider live support for hosted models", () => {
    expect(
      resolveLiveLanguageSupportMode({
        isOnDeviceModel: false,
        useLiveOnDeviceModel: false,
        liveSupported: true,
      }),
    ).toBe(true);
  });

  test("keeps batch-only on-device models in batch mode", () => {
    expect(
      resolveLiveLanguageSupportMode({
        isOnDeviceModel: true,
        useLiveOnDeviceModel: false,
        liveSupported: true,
      }),
    ).toBe(false);
  });

  test("requires provider live support for realtime on-device models", () => {
    expect(
      resolveLiveLanguageSupportMode({
        isOnDeviceModel: true,
        useLiveOnDeviceModel: true,
        liveSupported: false,
      }),
    ).toBe(false);
  });
});
||||||| parent of 9ff709349 (chore: sync local-first fork changes before rebase)

describe("resolveLiveLanguageSupportMode", () => {
  test("uses provider live support for hosted models", () => {
    expect(
      resolveLiveLanguageSupportMode({
        isOnDeviceModel: false,
        useLiveOnDeviceModel: false,
        liveSupported: true,
      }),
    ).toBe(true);
  });

  test("keeps batch-only on-device models in batch mode", () => {
    expect(
      resolveLiveLanguageSupportMode({
        isOnDeviceModel: true,
        useLiveOnDeviceModel: false,
        liveSupported: true,
      }),
    ).toBe(false);
  });

  test("requires provider live support for realtime on-device models", () => {
    expect(
      resolveLiveLanguageSupportMode({
        isOnDeviceModel: true,
        useLiveOnDeviceModel: true,
        liveSupported: false,
      }),
    ).toBe(false);
  });
});
=======
>>>>>>> 9ff709349 (chore: sync local-first fork changes before rebase)
