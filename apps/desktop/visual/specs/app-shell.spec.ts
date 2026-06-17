import { expect, test } from "../support/fixtures";

// The main app shell (empty state: no sessions/notes seeded). Renders via the
// mocked Tauri backend; sessions/chat stay empty because the persisters have
// no files to load. Captured in light + dark.
test("main app shell (empty state)", async ({ page }) => {
  await page.goto("/app/main");
  await page
    .getByTestId("main-app-shell")
    .waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  await expect(page).toHaveScreenshot("app-shell.png", { fullPage: true });
});
