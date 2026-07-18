// Installed into the page (via addInitScript) BEFORE app code runs, so the
// desktop bundle boots in a plain browser without a Tauri backend.
//
// Tauri v2 routes every command through window.__TAURI_INTERNALS__.invoke.
// We answer with safe empties by default and override the handful of commands
// the boot path needs. Extend `handlers` as new screens are snapshotted.
export function installTauriMock() {
  const noop = () => {};
  let callbackId = 0;

  // @tauri-apps/api isTauri() gates Tauri-only code paths on this flag.
  (window as unknown as Record<string, unknown>).isTauri = true;

  // command name -> value (or fn(args) -> value). Default: null.
  const handlers: Record<string, unknown | ((args: unknown) => unknown)> = {
    // window/webview identity used during boot
    "plugin:webview|get_all_webviews": [],
    "plugin:window|current_window": { label: "main" },
    // event system: pretend we registered, never emit
    "plugin:event|listen": () => ++callbackId,
    "plugin:event|unlisten": noop,
    // db / store live queries: empty result sets
    "plugin:db|execute": [],
    "plugin:db|subscribe": () => ({
      id: `sub-${++callbackId}`,
      analysis: { kind: "non_reactive", data: { reason: "mocked backend" } },
    }),
    "plugin:store2|get": null,
    // filesystem: vault root + directory scans. Session files come from the
    // per-test seed (seedSessions) and only for the sessions dir, so other
    // persisters (chat/events/…) get an empty scan rather than mis-parsing.
    "plugin:settings|vault_base": "/data",
    "plugin:fs-sync|scan_and_read": (args: unknown) => {
      const seed =
        ((window as unknown as Record<string, unknown>).__VISUAL_SEED__ as {
          sessionFiles?: Record<string, string>;
        }) ?? {};
      const dir = (args as { scanDir?: string })?.scanDir ?? "";
      const files = dir.endsWith("sessions") ? (seed.sessionFiles ?? {}) : {};
      return { files };
    },
    // os / detect
    "plugin:os|platform": "macos",
    "plugin:os|arch": "aarch64",
  };

  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
    invoke: (cmd: string, args: unknown) => {
      // Per-test overrides (set via mockCommands()) win over the defaults.
      const overrides =
        ((window as unknown as Record<string, unknown>)
          .__VISUAL_MOCK_OVERRIDES__ as Record<string, unknown>) ?? {};
      const h = cmd in overrides ? overrides[cmd] : handlers[cmd];
      const value =
        typeof h === "function"
          ? (h as (a: unknown) => unknown)(args)
          : (h ?? null);
      return Promise.resolve(value);
    },
    transformCallback: (cb?: (v: unknown) => void) => {
      const id = ++callbackId;
      (window as unknown as Record<number, unknown>)[id] = cb ?? noop;
      return id;
    },
    unregisterCallback: noop,
    convertFileSrc: (p: string) => p,
    // @tauri-apps/api/path sep() reads this synchronously.
    plugins: { path: { sep: "/" } },
    // some plugins read metadata off this object
    metadata: {
      currentWindow: { label: "main" },
      currentWebview: { label: "main" },
    },
  };

  (window as unknown as Record<string, unknown>).__TAURI_OS_PLUGIN_INTERNALS__ =
    {
      os_type: "macos",
      platform: "macos",
      arch: "aarch64",
      family: "unix",
    };

  // Event API reads this directly on unlisten().
  (
    window as unknown as Record<string, unknown>
  ).__TAURI_EVENT_PLUGIN_INTERNALS__ = {
    unregisterListener: noop,
  };
}
