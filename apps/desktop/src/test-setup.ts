import { randomUUID } from "node:crypto";
import { vi } from "vitest";

Object.defineProperty(globalThis.crypto, "randomUUID", { value: randomUUID });

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock;

if (typeof window !== "undefined") {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
}

if (typeof window !== "undefined" && !window.PointerEvent) {
  class PointerEventMock extends MouseEvent {
    pointerId: number;
    pointerType: string;
    width: number;
    height: number;
    pressure: number;
    tangentialPressure: number;
    tiltX: number;
    tiltY: number;
    twist: number;
    isPrimary: boolean;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.pointerType = params.pointerType ?? "mouse";
      this.width = params.width ?? 1;
      this.height = params.height ?? 1;
      this.pressure = params.pressure ?? 0;
      this.tangentialPressure = params.tangentialPressure ?? 0;
      this.tiltX = params.tiltX ?? 0;
      this.tiltY = params.tiltY ?? 0;
      this.twist = params.twist ?? 0;
      this.isPrimary = params.isPrimary ?? false;
    }
  }
  globalThis.PointerEvent = PointerEventMock as any;
  window.PointerEvent = PointerEventMock as any;
}

Object.defineProperty(globalThis.window, "__TAURI_INTERNALS__", {
  value: {
    metadata: {
      currentWindow: {
        label: "main",
      },
      currentWebview: {
        label: "main",
      },
    },
    invoke: vi.fn().mockRejectedValue(new Error("not available in test")),
  },
  writable: true,
  configurable: true,
});

vi.mock("@tauri-apps/api/path", () => ({
  sep: vi.fn().mockReturnValue("/"),
}));

vi.mock("@tauri-apps/plugin-os", () => ({
  platform: vi.fn().mockReturnValue("macos"),
}));

vi.mock("@tanstack/react-router", () => ({
  useRouteContext: vi.fn().mockReturnValue({ persistedStore: {} }),
  useRouter: vi.fn().mockReturnValue({
    state: {
      location: { href: "/" },
    },
    navigate: vi.fn(),
  }),
}));

vi.mock("@meetspace/plugin-db", () => ({
  execute: vi.fn().mockResolvedValue([]),
  executeProxy: vi.fn().mockResolvedValue({ rows: [] }),
  subscribe: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("@meetspace/plugin-analytics", () => ({
  commands: {
    event: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    setProperties: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    setDisabled: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    isDisabled: vi.fn().mockResolvedValue({ status: "ok", data: false }),
  },
}));

vi.mock("./types/tauri.gen", () => ({
  commands: {
    getOnboardingNeeded: vi
      .fn()
      .mockResolvedValue({ status: "ok", data: false }),
    getPinnedTabs: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    setPinnedTabs: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    getRecentlyOpenedSessions: vi
      .fn()
      .mockResolvedValue({ status: "ok", data: null }),
    setRecentlyOpenedSessions: vi
      .fn()
      .mockResolvedValue({ status: "ok", data: null }),
  },
}));
