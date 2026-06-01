import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  chat: {
    groupId: undefined as string | undefined,
    selectChat: vi.fn(),
    sessionId: "chat-session-id",
    setGroupId: vi.fn(),
    startNewChat: vi.fn(),
    mode: "RightPanelOpen" as string,
  },
  toolbarControls: vi.fn(),
}));

vi.mock("./toolbar-controls", () => ({
  ChatToolbarControls: (props: any) => {
    mocks.toolbarControls(props);
    return <div data-testid="chat-toolbar" />;
  },
}));

vi.mock("./use-session-tab", () => ({
  useSessionTab: () => ({ currentSessionId: "current-session-id" }),
}));

vi.mock("~/ai/hooks", () => ({
  useLanguageModel: () => undefined,
}));

vi.mock("~/chat/store/use-chat-actions", () => ({
  useChatActions: () => ({ handleSendMessage: vi.fn() }),
}));

vi.mock("~/contexts/shell", () => ({
  useShell: () => ({ chat: mocks.chat }),
}));

vi.mock("~/store/tinybase/store/main", () => ({
  STORE_ID: "main",
  UI: {
    useValues: () => ({ user_id: "test-user" }),
  },
}));

import { ChatView } from "./chat-panel";

describe("ChatView", () => {
  beforeEach(() => {
    cleanup();
    mocks.toolbarControls.mockClear();
  });

  it("renders simplified layout correctly", () => {
    const { container } = render(<ChatView />);
    const root = container.firstElementChild;

    expect(root?.className).toContain("flex");
    expect(root?.className).toContain("h-full");
    expect(screen.getByTestId("chat-toolbar")).toBeDefined();
  });
});
