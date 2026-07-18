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

// Seed the timeline with fake sessions so it renders populated. Sessions live
// in SQLite now, read through a `plugin:db|subscribe` live query
// (SELECT ... FROM sessions). The mock (tauri-mock.ts) delivers these rows on
// the channel for the timeline sessions subscription specifically.
export async function seedSessions(
  page: Page,
  sessions: { id: string; title: string; createdAt: string }[],
) {
  const sessionRows = sessions.map((s) => ({
    id: s.id,
    title: s.title,
    created_at: s.createdAt,
    event_json: null,
    folder_id: null,
  }));
  await page.addInitScript((rows) => {
    (window as unknown as Record<string, unknown>).__VISUAL_SEED__ = {
      sessionRows: rows,
    };
  }, sessionRows);
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
