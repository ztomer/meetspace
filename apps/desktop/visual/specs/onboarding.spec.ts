import { mockCommands } from "../support/app";
import { expect, test } from "../support/fixtures";

// First-run onboarding. Forced on by reporting onboarding as needed; otherwise
// the /app gate redirects to the main shell.
test("onboarding — first step", async ({ page }) => {
  await mockCommands(page, { get_onboarding_needed: true });
  await page.goto("/app/onboarding");
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1000);
  await expect(page).toHaveScreenshot("onboarding.png", { fullPage: true });
});
