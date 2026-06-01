import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@meetspace/ui/components/ui/button", () => ({
  Button: ({
    children,
    className,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button className={className} type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@meetspace/ui/components/ui/dropdown-menu", () => ({
  AppFloatingPanel: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("~/store/tinybase/store/main", () => ({
  STORE_ID: "main",
  UI: {
    useCell: () => undefined,
    useRow: () => undefined,
    useSortedRowIds: () => [],
  },
}));

import { ChatToolbarControls } from "./toolbar-controls";

describe("ChatToolbarControls", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders the simplified chat controls properly", () => {
    render(
      <ChatToolbarControls
        currentChatGroupId={undefined}
        onNewChat={vi.fn()}
        onCloseChat={vi.fn()}
        onSelectChat={vi.fn()}
        shortcutLabel="⌘ J"
      />,
    );

    const newChatButton = screen.getByRole("button", { name: "New chat" });
    const closeChatButton = screen.getByRole("button", { name: "Close chat" });

    expect(newChatButton).toBeDefined();
    expect(closeChatButton).toBeDefined();
  });
});
