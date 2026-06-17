import { describe, expect, it, vi } from "vitest";

import {
  createDevtoolsToastPreview,
  createToastRegistry,
  getToastToShow,
} from "./registry";

const baseParams = {
  hasLLMConfigured: true,
  hasSttConfigured: true,
  isAiTranscriptionTabActive: false,
  isAiIntelligenceTabActive: false,
  hasActiveDownload: false,
  downloadProgress: null,
  downloadingModel: null,
  activeDownloads: [],
  localSttStatus: null,
  isLocalSttModel: false,
  onOpenLLMSettings: vi.fn(),
  onOpenSTTSettings: vi.fn(),
};

describe("sidebar toast registry", () => {
  it("keeps the missing language model message short", () => {
    const toast = getToastToShow(
      createToastRegistry({
        ...baseParams,
        hasLLMConfigured: false,
      }),
      () => false,
    );

    expect(toast?.id).toBe("missing-llm");
    expect(toast?.description).toEqual(
      <>
        <strong className="font-mono">Language model</strong> is needed to make
        Meetspace summarize and chat about your conversations.
      </>,
    );
    expect(toast?.primaryAction?.label).toBe("Add intelligence");
  });

  it("keeps the missing transcription model message short", () => {
    const toast = getToastToShow(
      createToastRegistry({
        ...baseParams,
        hasSttConfigured: false,
      }),
      () => false,
    );

    expect(toast?.id).toBe("missing-stt");
    expect(toast?.description).toEqual(
      <>
        <strong className="font-mono">Transcription model</strong> is needed to
        make Meetspace listen to your conversations.
      </>,
    );
    expect(toast?.primaryAction?.label).toBe("Configure transcription");
  });

  it("creates devtools previews with app toast content", () => {
    const languageModelToast = createDevtoolsToastPreview({
      preview: "language-model",
      onSignIn: vi.fn(),
      onOpenLLMSettings: vi.fn(),
      onOpenSTTSettings: vi.fn(),
    });
    const downloadToast = createDevtoolsToastPreview({
      preview: "download",
      onSignIn: vi.fn(),
      onOpenLLMSettings: vi.fn(),
      onOpenSTTSettings: vi.fn(),
    });

    expect(languageModelToast.id).toBe("devtools-missing-llm");
    expect(languageModelToast.description).toBe("Language model needed");
    expect(languageModelToast.primaryAction?.label).toBe("Add");
    expect(downloadToast.id).toBe("devtools-downloading-model");
    expect(downloadToast.progress).toBe(42);
  });
});
