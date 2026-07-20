import { describe, expect, test } from "vitest";

import { createI18n } from "./catalogs";

// Bug 4 regression test: the compiled i18n catalogs were a broken partial
// compile (404 entries in `en` instead of 529), dropping message IDs that
// carry variables. When such a hash ID is missing from every catalog, lingui
// v6 returns the raw hash ("garbage") instead of the English source string.
// Restoring the complete `en` catalog (529 entries) means these IDs resolve to
// the readable English source fall back. This test pins that behavior.
describe("i18n fallback", () => {
  test("variable message falls back to English source, not the raw hash", () => {
    const i18n = createI18n("de");

    // `m_W9gE` = "{trialDaysRemaining} days left" — present in `en`, absent in `de`.
    const rendered = i18n._("m_W9gE", { trialDaysRemaining: 3 });
    expect(rendered).toBe("3 day left");
    expect(rendered).not.toBe("m_W9gE");
  });
});
