// Installed into the page (via addInitScript) BEFORE app code runs, so the
// desktop bundle boots in a plain browser without a Tauri backend.
//
// Tauri v2 routes every command through window.__TAURI_INTERNALS__.invoke.
// We answer with safe empties by default and override the handful of commands
// the boot path needs. Extend `handlers` as new screens are snapshotted.
export function installTauriMock() {
  const noop = () => {};
  let callbackId = 0;

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
    "plugin:db|subscribe": () => ++callbackId,
    "plugin:store2|get": null,
    // os / detect
    "plugin:os|platform": "macos",
    "plugin:os|arch": "aarch64",
  };

  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
    invoke: (cmd: string, args: unknown) => {
      const h = handlers[cmd];
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
}
