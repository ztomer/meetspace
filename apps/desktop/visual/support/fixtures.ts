import { test as base } from "@playwright/test";

import { installTauriMock } from "./tauri-mock";

// Shared fixture: every test gets a page with Tauri IPC mocked before any app
// code runs. (Animations are frozen at screenshot time via the config's
// expect.toHaveScreenshot.animations = "disabled".)
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(installTauriMock);
    await use(page);
  },
});

export { expect } from "@playwright/test";
