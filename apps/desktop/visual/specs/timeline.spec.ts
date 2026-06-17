import { openShell, seedSessions } from "../support/app";
import { expect, test } from "../support/fixtures";

// Populated timeline: a few seeded sessions so the sidebar timeline renders
// real note items (created_at near the frozen clock so they land under Today).
test("timeline — populated", async ({ page }) => {
  await seedSessions(page, [
    {
      id: "q2-planning",
      title: "Q2 Planning Sync",
      createdAt: "2026-06-16T16:30:00.000Z",
    },
    {
      id: "design-review",
      title: "Design Review",
      createdAt: "2026-06-16T14:00:00.000Z",
    },
    {
      id: "1on1-alex",
      title: "1:1 with Alex",
      createdAt: "2026-06-15T15:00:00.000Z",
    },
  ]);
  await openShell(page);
  await expect(page.getByText("Q2 Planning Sync")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page).toHaveScreenshot("timeline-populated.png", {
    fullPage: true,
  });
});
