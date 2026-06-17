import { openSettings } from "../support/app";
import { expect, test } from "../support/fixtures";

// Settings carries most of the dark-mode / semantic-token surface area, so each
// section is snapshotted in light + dark. One test per section; if a section
// needs seeded data to render, give it its own handler in tauri-mock.ts.
const SECTIONS = [
  "App",
  "Data",
  "Notifications",
  "Permissions",
  "Calendar",
  "Contacts",
  "Intelligence",
  "Templates",
  "Integrations",
];

for (const section of SECTIONS) {
  test(`settings — ${section}`, async ({ page }) => {
    await openSettings(page, section);
    await expect(page).toHaveScreenshot(
      `settings-${section.toLowerCase()}.png`,
      {
        fullPage: true,
      },
    );
  });
}
