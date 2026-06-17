import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  openNew: vi.fn(),
  goBack: vi.fn(),
  goNext: vi.fn(),
  runEscapeShortcut: vi.fn(),
  toggleLeftSidebar: vi.fn(),
  isTauri: vi.fn(() => true),
  startDragging: vi.fn().mockResolvedValue(undefined),
  canGoBack: false,
  canGoNext: false,
  leftSidebarExpanded: true,
  sidebarUpdateControl: {
    status: null as null | "available" | "downloading" | "ready" | "failed",
    version: null as string | null,
    progress: null as number | null,
    errorMessage: null as string | null,
    downloadStarting: false,
    installing: false,
    downloadUpdate: vi.fn(),
    installUpdate: vi.fn(),
  },
  currentTab: {
    active: true,
    pinned: false,
    slotId: "slot-1",
    type: "empty",
  } as any,
  tabs: [
    { active: true, pinned: false, slotId: "slot-1", type: "empty" },
  ] as any[],
  sidebarTimelineEnabled: false,
}));

vi.mock("~/shared/useTabsShortcuts", () => ({
  useMainEscapeShortcutAction: vi.fn(() => mocks.runEscapeShortcut),
}));

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: mocks.isTauri,
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    startDragging: mocks.startDragging,
  }),
}));

vi.mock("~/main/useTabsShortcuts", () => ({
  useClassicMainTabsShortcuts: vi.fn(() => ({
    runEscapeShortcut: mocks.runEscapeShortcut,
  })),
}));

vi.mock("~/main/tab-content", () => ({
  ClassicMainTabContent: ({ tab }: { tab: { type: string } }) => (
    <div data-testid="main-tab-content">{tab.type}</div>
  ),
}));

vi.mock("~/main/top-meeting-timeline", () => ({
  TopMeetingTimeline: () => <div data-testid="top-meeting-timeline" />,
}));

vi.mock("~/main/update-banner", () => ({
  SidebarTimelineUpdateButton: ({
    update,
  }: {
    update: { status: string | null; version: string | null };
  }) =>
    update.status && update.version ? (
      <button type="button" data-testid="sidebar-update-button" />
    ) : null,
  TimelineUpdateBanner: () => <div data-testid="timeline-update-banner" />,
  useDesktopUpdateControl: () => mocks.sidebarUpdateControl,
}));

vi.mock("~/main/shell-sidebar", () => ({
  ClassicMainSidebar: () => <div data-testid="main-sidebar" />,
}));

vi.mock("~/contexts/shell", () => ({
  useShell: () => ({
    leftsidebar: {
      expanded: mocks.leftSidebarExpanded,
      toggleExpanded: mocks.toggleLeftSidebar,
      setExpanded: vi.fn(),
    },
    chat: {
      mode: "FloatingClosed",
      sendEvent: vi.fn(),
    },
  }),
}));

vi.mock("~/session/components/bottom-accessory/global-live", () => ({
  GlobalLiveTranscriptAccessory: ({
    children,
    currentTab,
  }: {
    children: React.ReactNode;
    currentTab: { type: string } | null;
  }) => (
    <div
      data-current-tab-type={currentTab?.type ?? ""}
      data-testid="global-live-transcript-accessory"
    >
      {children}
    </div>
  ),
}));

vi.mock("~/shared/config", () => ({
  useConfigValue: () => mocks.sidebarTimelineEnabled,
}));

vi.mock("~/sidebar/toast", () => ({
  ToastArea: () => <div data-testid="toast-area" />,
}));

vi.mock("~/stt/contexts", () => ({
  useListener: vi.fn((selector) =>
    selector({
      live: {
        sessionId: null,
        status: "inactive",
      },
    }),
  ),
}));

vi.mock("@meetspace/ui/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("~/sidebar/profile", () => ({
  ProfileMenu: () => <div data-testid="profile-menu" />,
}));

vi.mock("~/sidebar/update", () => ({
  Update: () => <div data-testid="update-button" />,
}));

vi.mock("~/contexts/notifications", () => ({
  useNotifications: () => ({
    shouldShowBadge: false,
  }),
}));

vi.mock("~/shared/hooks/useNativeContextMenu", () => ({
  useNativeContextMenu: () => vi.fn(),
}));

vi.mock("~/shared/main/tab-scroll", () => ({
  useScrollActiveTabIntoView: () => vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn().mockReturnValue({ data: false }),
}));

vi.mock("~/store/zustand/tabs", () => {
  const getMockState = () => ({
    tabs: mocks.tabs,
    currentTab: mocks.currentTab,
    canGoBack: mocks.canGoBack,
    canGoNext: mocks.canGoNext,
    goBack: mocks.goBack,
    goNext: mocks.goNext,
    openNew: mocks.openNew,
    select: vi.fn(),
    close: vi.fn(),
    reorder: vi.fn(),
    closeOthers: vi.fn(),
    closeAll: vi.fn(),
    pin: vi.fn(),
    unpin: vi.fn(),
    pendingCloseConfirmationTab: null,
    setPendingCloseConfirmationTab: vi.fn(),
  });
  const useTabs = vi.fn((selector: (state: unknown) => unknown) =>
    selector(getMockState()),
  );
  (useTabs as any).getState = getMockState;
  return {
    uniqueIdfromTab: vi.fn(() => "empty-slot"),
    useTabs,
  };
});

import { ClassicMainBody } from "~/main/body";

describe("ClassicMainBody", () => {
  beforeEach(() => {
    mocks.openNew.mockClear();
    mocks.goBack.mockClear();
    mocks.goNext.mockClear();
    mocks.runEscapeShortcut.mockClear();
    mocks.toggleLeftSidebar.mockClear();
    mocks.isTauri.mockReturnValue(true);
    mocks.startDragging.mockClear();
    mocks.canGoBack = false;
    mocks.canGoNext = false;
    mocks.leftSidebarExpanded = true;
    mocks.sidebarUpdateControl.status = null;
    mocks.sidebarUpdateControl.version = null;
    mocks.sidebarUpdateControl.progress = null;
    mocks.sidebarUpdateControl.errorMessage = null;
    mocks.sidebarUpdateControl.downloadStarting = false;
    mocks.sidebarUpdateControl.installing = false;
    mocks.sidebarUpdateControl.downloadUpdate.mockClear();
    mocks.sidebarUpdateControl.installUpdate.mockClear();
    mocks.currentTab = {
      active: true,
      pinned: false,
      slotId: "slot-1",
      type: "empty",
    };
    mocks.tabs = [
      { active: true, pinned: false, slotId: "slot-1", type: "empty" },
    ];
    mocks.sidebarTimelineEnabled = false;
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the shell and current tab content", () => {
    render(<ClassicMainBody />);

    const timeline = screen.getByTestId("top-meeting-timeline");
    const timelineRow = timeline.parentElement?.parentElement;
    const topArea = timelineRow?.parentElement;

    expect(timeline).toBeTruthy();
    expect(timelineRow?.className).toContain("pl-[76px]");
    expect(timelineRow?.className).toContain("pt-1");
    expect(timelineRow?.hasAttribute("data-tauri-drag-region")).toBe(true);
    expect(timeline.parentElement?.className).toContain("flex-1");
    expect(topArea?.className).toContain("h-12");
    expect(topArea?.hasAttribute("data-tauri-drag-region")).toBe(true);
    expect(screen.getByTestId("timeline-update-banner")).toBeTruthy();
    expect(screen.getByTestId("main-sidebar")).toBeTruthy();
    expect(screen.getByTestId("main-tab-content").textContent).toContain(
      "empty",
    );
  });

  it("does not reserve top shell chrome for onboarding", () => {
    mocks.currentTab = {
      active: true,
      pinned: false,
      slotId: "slot-1",
      type: "onboarding",
    };

    const { container } = render(<ClassicMainBody />);
    const body = container.firstElementChild;
    const contentChild = body?.children[1];

    expect(screen.queryByTestId("top-meeting-timeline")).toBeNull();
    expect(screen.queryByTestId("timeline-update-banner")).toBeNull();
    expect(screen.queryByTestId("toast-area")).toBeNull();
    expect(contentChild?.className).toContain(
      "flex min-h-0 min-w-0 flex-1 gap-1",
    );
    expect(contentChild?.hasAttribute("data-tauri-drag-region")).toBe(false);
    expect(screen.getByTestId("main-tab-content").textContent).toContain(
      "onboarding",
    );
  });

  it("hides the top timeline when the sidebar timeline is enabled", () => {
    mocks.sidebarTimelineEnabled = true;

    render(<ClassicMainBody />);

    expect(screen.queryByTestId("top-meeting-timeline")).toBeNull();
    expect(screen.queryByTestId("timeline-update-banner")).toBeNull();
    expect(screen.queryByTestId("toast-area")).toBeNull();
    const sidebar = screen.getByTestId("main-sidebar");
    const sidebarToggle = screen.getByRole("button", { name: "Hide sidebar" });
    const backButton = screen.getByRole("button", { name: "Go back" });
    const chrome = sidebarToggle.parentElement?.parentElement;
    const topArea = chrome?.parentElement?.parentElement;

    expect(sidebar).toBeTruthy();
    expect(sidebarToggle).toBeTruthy();
    expect(screen.queryByTestId("sidebar-update-button")).toBeNull();
    expect(screen.queryByRole("button", { name: "Open calendar" })).toBeNull();
    expect(backButton.hasAttribute("disabled")).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Go forward" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(backButton.parentElement?.className).toContain("gap-0");
    expect(chrome?.className).toContain("justify-between");
    expect(chrome?.className).toContain("w-full");
    expect(topArea?.className).toContain("h-12");
    expect(topArea?.className).toContain("absolute");
    expect(topArea?.className).toContain("left-0");
    expect(sidebar.parentElement?.className).toContain("flex min-h-0");
    expect(sidebar.parentElement?.className).not.toContain("pt-12");
  });

  it("expands the main area to the full window when sidebar timeline mode is collapsed", () => {
    mocks.sidebarTimelineEnabled = true;
    mocks.leftSidebarExpanded = false;
    mocks.canGoBack = true;
    mocks.canGoNext = true;

    const { container } = render(<ClassicMainBody />);
    const body = container.firstElementChild;
    const contentRow = body?.lastElementChild;
    const sidebarToggle = screen.getByRole("button", { name: "Show sidebar" });
    const backButton = screen.getByRole("button", { name: "Go back" });
    const chrome = sidebarToggle.parentElement?.parentElement;
    const topArea = chrome?.parentElement?.parentElement;

    fireEvent.click(sidebarToggle);
    fireEvent.click(backButton);
    fireEvent.click(screen.getByRole("button", { name: "Go forward" }));

    expect(screen.queryByTestId("top-meeting-timeline")).toBeNull();
    expect(screen.queryByTestId("timeline-update-banner")).toBeNull();
    expect(screen.queryByTestId("sidebar-update-button")).toBeNull();
    expect(backButton.parentElement?.className).toContain("gap-0");
    expect(topArea?.className).toContain("absolute");
    expect(topArea?.className).toContain("h-12");
    expect(topArea?.className).toContain("left-1");
    expect(contentRow?.className).toContain(
      "flex min-h-0 min-w-0 flex-1 gap-1",
    );
    expect(contentRow?.hasAttribute("data-tauri-drag-region")).toBe(false);
    expect(mocks.toggleLeftSidebar).toHaveBeenCalledTimes(1);
    expect(mocks.goBack).toHaveBeenCalledTimes(1);
    expect(mocks.goNext).toHaveBeenCalledTimes(1);
  });

  it("shows the update button at the far end of expanded sidebar timeline chrome", () => {
    mocks.sidebarTimelineEnabled = true;
    mocks.sidebarUpdateControl.status = "available";
    mocks.sidebarUpdateControl.version = "1.0.34";

    render(<ClassicMainBody />);

    const sidebarToggle = screen.getByRole("button", { name: "Hide sidebar" });
    const chrome = sidebarToggle.parentElement?.parentElement;

    expect(screen.getByTestId("sidebar-update-button")).toBeTruthy();
    expect(chrome?.className).toContain("justify-between");
    expect(chrome?.lastElementChild?.getAttribute("data-testid")).toBe(
      "sidebar-update-button",
    );
    expect(
      within(sidebarToggle).queryByTestId("collapsed-sidebar-update-badge"),
    ).toBeNull();
  });

  it("shows an update badge on the collapsed sidebar timeline toggle", () => {
    mocks.sidebarTimelineEnabled = true;
    mocks.leftSidebarExpanded = false;
    mocks.sidebarUpdateControl.status = "available";
    mocks.sidebarUpdateControl.version = "1.0.34";

    render(<ClassicMainBody />);

    const sidebarToggle = screen.getByRole("button", { name: "Show sidebar" });

    fireEvent.click(sidebarToggle);

    expect(screen.queryByTestId("sidebar-update-button")).toBeNull();
    expect(
      within(sidebarToggle).getByTestId("collapsed-sidebar-update-badge"),
    ).toBeTruthy();
    expect(mocks.toggleLeftSidebar).toHaveBeenCalledTimes(1);
  });

  it("hides timeline chrome for changelog tabs without collapsing the sidebar state", () => {
    mocks.currentTab = {
      active: true,
      pinned: false,
      slotId: "slot-1",
      type: "changelog",
    };

    const { container } = render(<ClassicMainBody />);
    const body = container.firstElementChild;
    const topArea = body?.children[1];

    expect(screen.queryByTestId("top-meeting-timeline")).toBeNull();
    expect(screen.queryByTestId("timeline-update-banner")).toBeNull();
    expect(screen.queryByRole("button", { name: "Go back" })).toBeNull();
    expect(topArea?.className).toContain("h-10");
    expect(screen.getByTestId("main-tab-content").textContent).toContain(
      "changelog",
    );
  });

  it("keeps sidebar timeline chrome for changelog tabs in sidebar timeline mode", () => {
    mocks.currentTab = {
      active: true,
      pinned: false,
      slotId: "slot-1",
      type: "changelog",
    };
    mocks.sidebarTimelineEnabled = true;

    render(<ClassicMainBody />);

    const backButton = screen.getByRole("button", { name: "Go back" });
    const chrome = backButton.parentElement?.parentElement;
    const topArea = chrome?.parentElement?.parentElement;

    expect(screen.queryByTestId("top-meeting-timeline")).toBeNull();
    expect(screen.queryByTestId("timeline-update-banner")).toBeNull();
    expect(backButton.hasAttribute("disabled")).toBe(true);
    expect(backButton.parentElement?.className).toContain("gap-0");
    expect(topArea?.className).toContain("h-12");
    expect(topArea?.className).toContain("absolute");
    expect(screen.getByTestId("main-tab-content").textContent).toContain(
      "changelog",
    );
  });

  it("navigates history from the sidebar timeline chrome", () => {
    mocks.sidebarTimelineEnabled = true;
    mocks.canGoBack = true;
    mocks.canGoNext = true;

    render(<ClassicMainBody />);

    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    fireEvent.click(screen.getByRole("button", { name: "Go forward" }));

    expect(mocks.openNew).not.toHaveBeenCalled();
    expect(mocks.goBack).toHaveBeenCalledTimes(1);
    expect(mocks.goNext).toHaveBeenCalledTimes(1);
  });

  it.each(["calendar", "settings", "contacts", "templates"])(
    "runs the escape shortcut from the %s left chrome back button",
    (type) => {
      mocks.currentTab = {
        active: true,
        pinned: false,
        slotId: "slot-1",
        type,
      };

      render(<ClassicMainBody />);

      const backButton = screen.getByRole("button", { name: "Go back" });
      const topArea = backButton.parentElement?.parentElement;

      fireEvent.click(backButton);

      expect(screen.queryByTestId("top-meeting-timeline")).toBeNull();
      expect(screen.queryByTestId("timeline-update-banner")).toBeNull();
      expect(screen.queryByRole("button", { name: "Go forward" })).toBeNull();
      expect(backButton.hasAttribute("disabled")).toBe(false);
      expect(topArea?.className).toContain("h-12");
      expect(topArea?.className).toContain("absolute");
      expect(mocks.goBack).not.toHaveBeenCalled();
      expect(mocks.runEscapeShortcut).toHaveBeenCalledTimes(1);
    },
  );

  it("starts window dragging from the top 48px of the main area in sidebar timeline mode", () => {
    mocks.sidebarTimelineEnabled = true;

    render(<ClassicMainBody />);

    const mainContent = screen.getByTestId("main-tab-content");

    fireEvent.pointerDown(mainContent, {
      button: 0,
      clientX: 12,
      clientY: 12,
      pointerId: 1,
    });
    fireEvent.pointerMove(mainContent, {
      clientX: 20,
      clientY: 12,
      pointerId: 1,
    });

    expect(mocks.startDragging).toHaveBeenCalledTimes(1);
  });

  it("does not start window dragging below the main area drag strip", () => {
    mocks.sidebarTimelineEnabled = true;

    render(<ClassicMainBody />);

    const mainContent = screen.getByTestId("main-tab-content");

    fireEvent.pointerDown(mainContent, {
      button: 0,
      clientX: 12,
      clientY: 56,
      pointerId: 1,
    });
    fireEvent.pointerMove(mainContent, {
      clientX: 20,
      clientY: 56,
      pointerId: 1,
    });

    expect(mocks.startDragging).not.toHaveBeenCalled();
  });

  it("does not add main area dragging when the top timeline owns the titlebar", () => {
    render(<ClassicMainBody />);

    const mainContent = screen.getByTestId("main-tab-content");

    fireEvent.pointerDown(mainContent, {
      button: 0,
      clientX: 12,
      clientY: 12,
      pointerId: 1,
    });
    fireEvent.pointerMove(mainContent, {
      clientX: 20,
      clientY: 12,
      pointerId: 1,
    });

    expect(mocks.startDragging).not.toHaveBeenCalled();
  });

  it("renders the shell while the initial tab is still loading", async () => {
    mocks.tabs = [];
    mocks.currentTab = null;

    const { container } = render(<ClassicMainBody />);
    const view = within(container);

    expect(view.getByTestId("main-sidebar")).toBeTruthy();
    expect(view.getByTestId("top-meeting-timeline")).toBeTruthy();
    expect(view.getByTestId("timeline-update-banner")).toBeTruthy();
    expect(view.queryByTestId("main-tab-content")).toBeNull();
  });
});
