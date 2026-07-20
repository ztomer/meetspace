# Bug: i18n garbage — raw hash IDs instead of translated values

**Severity:** High — every non-English user sees raw message hashes (e.g. `m_W9gE`)
where a translated/interpolated string should be, for any message carrying a variable.
**Status:** Root-caused and fixed. Proof: `src/i18n/catalogs.test.ts`.

## Symptom
In non-English locales, strings with variables render as garbage — the raw lingui
message hash (`m_W9gE`, `y_Jg1h`, …) instead of e.g. `3 days left`. Plain strings
without variables fell back to the English source text (acceptable); only
variable-bearing messages showed hashes.

## Root cause
The compiled i18n catalogs in the working tree were a **broken partial compile**.
`en/messages.ts` had **404** entries; the committed (correct) version has **529**.
The 125 dropped IDs include every variable-bearing message
(`m_W9gE` = `{trialDaysRemaining} days left`, `y_Jg1h`, `H1bfYt`, `AYiE9H`, …).

lingui v6 (`@lingui/core` ^6) resolves a message as
`messageForId || message || id` (`node_modules/@lingui/core/dist/index.mjs`). When a
hash ID is missing from the active (`de`) catalog **and** from the `en` catalog, it
returns the raw `id` — the hash. That is the visible garbage. The fix is to ship the
complete `en` catalog so every ID resolves to its readable English source.

(Non-`en` catalogs also have ~385 empty `msgstr` entries — expected, since those
locales are simply not yet translated; lingui falls back to the `en` source text for
those, which is correct behavior.)

## Affected files
- `apps/desktop/src/i18n/locales/**/messages.po` + `messages.ts` — broken working-tree
  regeneration (218 files modified, uncommitted).

## Fix applied
Reverted the working-tree locale catalogs to HEAD
(`git checkout -- apps/desktop/src/i18n/locales/`), restoring the complete 529-entry
`en` catalog. Removed the earlier (invalid for lingui v6) `setupI18n({sourceLocale,
fallbackLocales})` attempt — v6 has no such props and already falls back to the msgid.

## Durable guard
- `src/i18n/catalogs.test.ts` asserts `createI18n("de")._("m_W9gE", {trialDaysRemaining:3})`
  returns `"3 day left"`, not the raw hash.
- Add an `i18n:check` CI gate (already wired in `package.json`) so a future partial
  compile fails the build instead of shipping.
- **Script-level fix:** `rebase-on-main.sh` no longer runs `i18n:extract --clean`
  (the `--clean` pass drops ~125 messages and reproduces this exact bug). It now runs
  incremental `i18n:extract` (keeps the committed 529-entry `en`, only adds new
  post-rebrand hashes) followed by `i18n:compile`, and warns if `en/messages.po`
  drops below 400 messages. `sync-upstream.sh` already used the safe incremental
  extract.

## Verification
- `pnpm -F desktop test src/i18n/catalogs.test.ts` → pass.
- `pnpm smoke` → app boots, i18n initializes without error.
