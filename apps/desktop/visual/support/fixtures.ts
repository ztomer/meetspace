import { test as base } from "@playwright/test";

import { installTauriMock } from "./tauri-mock";

// Fixed instant so on-screen clocks/relative times render identically every
// run. setFixedTime overrides Date/now without faking the timer queue, so app
// timers (tinytick, reveal delays) still fire.
const FIXED_TIME = new Date("2026-06-16T17:00:00.000Z");

// Shared fixture: Tauri IPC mocked + clock frozen before any app code runs.
// (Animations are frozen at screenshot time via the config's
// expect.toHaveScreenshot.animations = "disabled".)
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(FIXED_TIME);
    await page.addInitScript(installTauriMock);
    await use(page);
  },
});

export { expect } from "@playwright/test";
