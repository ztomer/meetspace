import { randomUUID } from "node:crypto";
import * as React from "react";
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
    transformCallback: vi.fn((callback: unknown) => {
      const callbackId = Math.trunc(Math.random() * Number.MAX_SAFE_INTEGER);
      Object.assign(globalThis.window, {
        [`_${callbackId}`]: callback,
      });

      return callbackId;
    }),
    unregisterCallback: vi.fn((callbackId: number) => {
      delete (globalThis.window as unknown as Record<string, unknown>)[
        `_${callbackId}`
      ];
    }),
    invoke: vi.fn((command: string) =>
      Promise.resolve(command === "plugin:event|listen" ? 0 : null),
    ),
  },
  writable: true,
  configurable: true,
});

Object.defineProperty(globalThis.window, "__TAURI_EVENT_PLUGIN_INTERNALS__", {
  value: {
    unregisterListener: vi.fn(),
  },
  writable: true,
  configurable: true,
});

vi.mock("@tauri-apps/api/path", () => ({
  resolveResource: vi.fn((path: string) =>
    Promise.resolve(`/resources/${path}`),
  ),
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

function translate(
  input:
    | TemplateStringsArray
    | string
    | { message?: string; values?: Record<string, unknown> },
  ...values: unknown[]
) {
  if (typeof input === "string") {
    return input;
  }

  if (typeof input === "object" && !("raw" in input)) {
    let message = input.message ?? "";
    for (const [key, value] of Object.entries(input.values ?? {})) {
      message = message.split(`{${key}}`).join(String(value));
    }
    return message;
  }

  return Array.from(input).reduce(
    (text, part, index) => `${text}${part}${values[index] ?? ""}`,
    "",
  );
}

vi.mock("@lingui/react/macro", () => ({
  Trans: ({
    children,
    id,
    message,
    values,
  }: {
    children?: React.ReactNode;
    id?: string;
    message?: string;
    values?: Record<string, unknown>;
  }) =>
    React.createElement(
      React.Fragment,
      null,
      children ?? translate({ message: message ?? id, values }),
    ),
  useLingui: () => ({
    _: translate,
    t: translate,
  }),
}));

vi.mock("@lingui/react", () => ({
  I18nProvider: ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  Trans: ({
    children,
    id,
    message,
    values,
  }: {
    children?: React.ReactNode;
    id?: string;
    message?: string;
    values?: Record<string, unknown>;
  }) =>
    React.createElement(
      React.Fragment,
      null,
      children ?? translate({ message: message ?? id, values }),
    ),
  useLingui: () => ({
    _: translate,
    t: translate,
    i18n: { locale: "en" },
  }),
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
    showDevtool: vi.fn().mockResolvedValue(true),
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
