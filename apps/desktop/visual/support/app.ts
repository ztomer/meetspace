import type { Page } from "@playwright/test";

// Boot to the main shell (empty state).
export async function openShell(page: Page) {
  await page.goto("/app/main");
  await page
    .getByTestId("main-app-shell")
    .waitFor({ state: "visible", timeout: 30_000 });
}

// Open the Settings tab and switch to a section by its nav label.
export async function openSettings(page: Page, section: string) {
  await openShell(page);
  await page.getByText("Settings", { exact: true }).first().click();
  await page.getByText("Appearance").first().waitFor({ timeout: 15_000 });
  if (section !== "App") {
    await page
      .getByRole("button", { name: section, exact: true })
      .first()
      .click();
    await page.waitForTimeout(400);
  }
}
