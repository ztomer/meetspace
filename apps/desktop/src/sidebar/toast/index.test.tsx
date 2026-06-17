import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  dismissToast: vi.fn(),
  openNew: vi.fn(),
  updateSettingsTabState: vi.fn(),
  clearDevtoolsPreview: vi.fn(),
  setToastActionTarget: vi.fn(),
  message: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn(),
  sessionMode: "inactive",
  currentTab: {
    type: "empty",
  } as {
    type: string;
    id?: string;
    state?: { tab?: string; view?: { type: string } };
  },
  config: {
    current_llm_provider: "local" as string | null,
    current_llm_model: "model" as string | null,
    current_stt_provider: "local" as string | null,
    current_stt_model: "model" as string | null,
  },
  notifications: {
    hasActiveDownload: false,
    downloadingModel: null as string | null,
    activeDownloads: [] as Array<{
      model: string;
      displayName: string;
      progress: number;
    }>,
    localSttStatus: null as null | "loading" | "unreachable",
    isLocalSttModel: false,
  },
}));

vi.mock("@meetspace/ui/components/ui/toast", () => ({
  sonnerToast: {
    message: mocks.message,
    error: mocks.error,
    warning: mocks.warning,
    loading: mocks.loading,
    dismiss: mocks.dismiss,
  },
}));

vi.mock("~/auth", () => ({
  useAuth: () => ({ session: null, signIn: mocks.signIn }),
}));

vi.mock("~/auth/cloudsync-progress", () => ({
  useCloudsyncInitialSyncProgress: () => ({ state: "idle" }),
}));

vi.mock("~/contexts/notifications", () => ({
  useNotifications: () => mocks.notifications,
}));

vi.mock("~/shared/config", () => ({
  useConfigValues: () => mocks.config,
}));

vi.mock("~/store/zustand/devtools-toast-preview", () => ({
  useDevtoolsToastPreview: (
    selector: (state: { preview: any; clearPreview: () => void }) => unknown,
  ) =>
    selector({
      preview: { type: "language-model", key: "test-key" },
      clearPreview: mocks.clearDevtoolsPreview,
    }),
}));

vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (
    selector: (state: {
      currentTab: typeof mocks.currentTab;
      openNew: () => void;
      updateSettingsTabState: () => void;
    }) => unknown,
  ) =>
    selector({
      currentTab: mocks.currentTab,
      openNew: mocks.openNew,
      updateSettingsTabState: mocks.updateSettingsTabState,
    }),
}));

vi.mock("~/store/zustand/toast-action", () => ({
  useToastAction: (
    selector: (state: { setTarget: (target: "stt" | null) => void }) => unknown,
  ) => selector({ setTarget: mocks.setToastActionTarget }),
}));

vi.mock("~/stt/capabilities", () => ({
  isConfiguredSttModel: () => true,
  isMeetspaceCloudSttModel: () => false,
}));

vi.mock("~/stt/contexts", () => ({
  useListener: (
    selector: (state: { getSessionMode: () => string }) => unknown,
  ) => selector({ getSessionMode: () => mocks.sessionMode }),
}));

vi.mock("./useDismissedToasts", () => ({
  useDismissedToasts: () => ({
    dismissToast: mocks.dismissToast,
    isDismissed: () => false,
  }),
}));

import { ToastNotifications } from "./index";

describe("ToastNotifications", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.signIn.mockClear();
    mocks.dismissToast.mockClear();
    mocks.message.mockClear();
    mocks.error.mockClear();
    mocks.warning.mockClear();
    mocks.loading.mockClear();
    mocks.dismiss.mockClear();
    mocks.openNew.mockClear();
    mocks.updateSettingsTabState.mockClear();
    mocks.currentTab = { type: "empty" };
    mocks.config.current_llm_provider = "local";
    mocks.config.current_llm_model = "model";
    mocks.config.current_stt_provider = "local";
    mocks.config.current_stt_model = "model";
    mocks.notifications.hasActiveDownload = false;
    mocks.notifications.downloadingModel = null;
    mocks.notifications.activeDownloads = [];
    mocks.notifications.localSttStatus = null;
    mocks.notifications.isLocalSttModel = false;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("routes registry notifications through Sonner", () => {
    render(<ToastNotifications />);

    act(() => vi.advanceTimersByTime(500));

    const toastContainer = screen
      .getByText("Language model needed")
      .closest(".fixed") as HTMLElement | null;

    expect(toastContainer?.style.left).toBe("calc(50% + 0px)");
    expect(toastContainer?.style.top).toBe("56px");
  });

  it("keeps default placement centered while anchoring vertically to the main surface", () => {
    const mainSurface = document.createElement("div");
    mainSurface.setAttribute("data-chat-floating-anchor", "");
    vi.spyOn(mainSurface, "getBoundingClientRect").mockReturnValue({
      bottom: 552,
      height: 500,
      left: 200,
      right: 800,
      top: 52,
      width: 600,
      x: 200,
      y: 52,
      toJSON: () => ({}),
    });
    document.body.appendChild(mainSurface);

    render(<ToastArea />);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    const toastContainer = screen
      .getByText("Pro features available")
      .closest(".fixed") as HTMLElement | null;

    expect(toastContainer?.style.left).toBe("calc(50% + 0px)");
    expect(toastContainer?.style.top).toBe("88px");
  });

  it("centers the left sidebar toast on the main content panel", () => {
    const mainContentPanel = document.createElement("div");
    mainContentPanel.setAttribute("data-main-content-panel", "");
    vi.spyOn(mainContentPanel, "getBoundingClientRect").mockReturnValue({
      bottom: 520,
      height: 500,
      left: 200,
      right: 1_000,
      top: 20,
      width: 800,
      x: 200,
      y: 20,
      toJSON: () => ({}),
    });
    document.body.appendChild(mainContentPanel);

    const mainSurface = document.createElement("div");
    mainSurface.setAttribute("data-chat-floating-anchor", "");
    vi.spyOn(mainSurface, "getBoundingClientRect").mockReturnValue({
      bottom: 520,
      height: 500,
      left: 300,
      right: 700,
      top: 20,
      width: 400,
      x: 300,
      y: 20,
      toJSON: () => ({}),
    });
    document.body.appendChild(mainSurface);

    render(<ToastArea placement="left-sidebar" />);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    const toastContainer = screen
      .getByText("Language model needed")
      .closest(".fixed") as HTMLElement | null;

    expect(toastContainer?.style.left).toBe("600px");
    expect(toastContainer?.style.top).toBe("56px");
  });

  it("centers anchored transient toasts on the main content panel", () => {
    const mainContentPanel = document.createElement("div");
    mainContentPanel.setAttribute("data-main-content-panel", "");
    vi.spyOn(mainContentPanel, "getBoundingClientRect").mockReturnValue({
      bottom: 520,
      height: 500,
      left: 200,
      right: 1_000,
      top: 20,
      width: 800,
      x: 200,
      y: 20,
      toJSON: () => ({}),
    });
    document.body.appendChild(mainContentPanel);

    const mainSurface = document.createElement("div");
    mainSurface.setAttribute("data-chat-floating-anchor", "");
    vi.spyOn(mainSurface, "getBoundingClientRect").mockReturnValue({
      bottom: 520,
      height: 500,
      left: 300,
      right: 700,
      top: 20,
      width: 400,
      x: 300,
      y: 20,
      toJSON: () => ({}),
    });
    document.body.appendChild(mainSurface);

    showTransientToast(
      {
        id: "transcription-language-warning",
        description: "Model doesn't support all languages.",
        anchor: "main-content-panel",
      },
      { durationMs: null },
    );

    const options = mocks.message.mock.calls[0][1];
    options.action.onClick();
    expect(mocks.signIn).toHaveBeenCalledOnce();

    options.onDismiss();
    expect(mocks.dismissToast).not.toHaveBeenCalled();
  });

  it("persists explicit Sonner dismissals", () => {
    render(<ToastNotifications />);

    act(() => vi.advanceTimersByTime(500));

    render(<ToastArea placement="left-sidebar" />);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    const toastContainer = screen
      .getByText("Language model needed")
      .closest(".fixed") as HTMLElement | null;

    expect(toastContainer?.style.top).toBe("56px");

    act(() => {
      top = 52;
      window.dispatchEvent(new Event("scroll"));
    });

    expect(toastContainer?.style.top).toBe("88px");
  });

  it("uses a Sonner loading toast for model downloads", () => {
    mocks.notifications.hasActiveDownload = true;
    mocks.notifications.downloadingModel = "Parakeet v3";
    mocks.notifications.activeDownloads = [
      { model: "am-parakeet-v3", displayName: "Parakeet v3", progress: 42 },
    ];

    render(<ToastNotifications />);

    act(() => vi.advanceTimersByTime(500));

    expect(mocks.loading).toHaveBeenCalledWith(
      "Downloading Parakeet v3",
      expect.objectContaining({
        id: "downloading-model",
        duration: Infinity,
        closeButton: false,
      }),
    );
  });

    const toastContainer = screen
      .getByText("Language model needed")
      .closest(".fixed") as HTMLElement | null;

    const view = render(<ToastNotifications />);

    act(() => vi.advanceTimersByTime(500));

    const options = mocks.message.mock.calls[0][1];

    mocks.currentTab = { type: "settings", state: { tab: "general" } };
    view.rerender(<ToastNotifications />);

    options.action.onClick();

    expect(mocks.updateSettingsTabState).toHaveBeenCalledWith(
      mocks.currentTab,
      { tab: "intelligence" },
    );
    expect(mocks.openNew).not.toHaveBeenCalled();
  });
});
