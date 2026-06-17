import { expect, test } from "../support/fixtures";

// Seed baseline: the NotFound screen renders without app state, so it's a
// stable first snapshot that exercises the real theme tokens, typography, and
// button styling in both light and dark (the two Playwright projects).
test("not-found screen", async ({ page }) => {
  await page.goto("/does-not-exist");
  await expect(page.getByText("Page not found")).toBeVisible();
  await expect(page).toHaveScreenshot("not-found.png", { fullPage: true });
});
