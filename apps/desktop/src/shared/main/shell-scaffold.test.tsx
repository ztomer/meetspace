import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentTab: { type: "empty" } as { type: string } | null,
}));

vi.mock("~/calendar/components/context", () => ({
  SyncProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sync-provider">{children}</div>
  ),
}));

vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (
    selector: (state: { currentTab: typeof mocks.currentTab }) => unknown,
  ) => selector({ currentTab: mocks.currentTab }),
}));

import { MainShellScaffold } from "./shell-scaffold";

describe("MainShellScaffold", () => {
  afterEach(() => {
    cleanup();
    mocks.currentTab = { type: "empty" };
  });

  it("renders without sync provider for non-calendar tabs", () => {
    render(
      <MainShellScaffold>
        <div data-testid="content" />
      </MainShellScaffold>,
    );

    expect(screen.queryByTestId("sync-provider")).toBeNull();
    expect(screen.getByTestId("main-app-shell")).toBeDefined();
  });

  it("wraps in sync provider for calendar tab", () => {
    mocks.currentTab = { type: "calendar" };
    render(
      <MainShellScaffold>
        <div data-testid="content" />
      </MainShellScaffold>,
    );

    expect(screen.getByTestId("sync-provider")).toBeDefined();
    expect(screen.getByTestId("main-app-shell")).toBeDefined();
  });
});
