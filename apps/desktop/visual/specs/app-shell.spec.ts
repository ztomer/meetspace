import { expect, test } from "../support/fixtures";

// EXPANSION POINT — full in-app screens (timeline, editor, settings, calendar)
// are where most visual regressions live, but `/app/*` routes need the Tauri
// event API mocked and the TinyBase settings/session stores seeded before they
// render (today they hit the error boundary under the headless mock).
//
// To enable: extend support/tauri-mock.ts (event listen/unlisten + plugin
// handlers) and add a store-seed init script, then point this at the route and
// drop `.fixme`. Until then, drive these screens via the exploratory loop in
// docs/VISUAL_TESTING.md (real app + screenshots).
test.fixme("main app shell", async ({ page }) => {
  await page.goto("/app/main");
  await page.getByTestId("main-app-shell").waitFor({ state: "visible" });
  await expect(page).toHaveScreenshot("app-shell.png", { fullPage: true });
});
