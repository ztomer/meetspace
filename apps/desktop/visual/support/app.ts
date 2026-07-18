import type { Page } from "@playwright/test";

// Override mocked Tauri command return values for one test. Call before
// navigation. Values are the raw `invoke` return (specta bindings wrap them
// into { status: "ok", data }).
export async function mockCommands(
  page: Page,
  overrides: Record<string, unknown>,
) {
  await page.addInitScript((o) => {
    (window as unknown as Record<string, unknown>).__VISUAL_MOCK_OVERRIDES__ =
      o;
  }, overrides);
}

// Seed the session store with fake sessions so the timeline renders populated.
// Feeds the session persister's scan_and_read with synthetic _meta.json files.
export async function seedSessions(
  page: Page,
  sessions: { id: string; title: string; createdAt: string }[],
) {
  const sessionFiles: Record<string, string> = {};
  for (const s of sessions) {
    sessionFiles[`${s.id}/_meta.json`] = JSON.stringify({
      user_id: "local-user",
      created_at: s.createdAt,
      title: s.title,
      participants: [],
    });
  }
  await page.addInitScript((files) => {
    (window as unknown as Record<string, unknown>).__VISUAL_SEED__ = {
      sessionFiles: files,
    };
  }, sessionFiles);
}

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
  await page
    .getByRole("button", { name: "App", exact: true })
    .first()
    .waitFor({ timeout: 15_000 });
  if (section !== "App") {
    await page
      .getByRole("button", { name: section, exact: true })
      .first()
      .click();
    await page.waitForTimeout(400);
  }
}
