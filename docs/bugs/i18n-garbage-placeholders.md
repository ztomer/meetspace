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
- `i18n:check` (wired in `package.json` as `lingui extract --clean && lingui compile
  --strict && git diff --exit-code`) is the CI gate: it fails if the committed
  catalogs drift from source. After the regeneration below, the committed catalogs
  are source-derived (~400 `en` msgids) and `i18n:check` passes clean.
- **Second incident — stale-Anarlog compile.** A later failure shipped an `en`
  catalog containing "Anarlog" strings (and missing the fork-added
  Integrations/Personalization sections → raw-hash UI). Root cause: the committed
  `.po` files still carry stale upstream "Anarlog" msgids, and `lingui compile`
  compiles OBSOLETE (`#~`) entries too, so any `i18n:compile` regenerates an
  Anarlog-laced `en.ts`. Fix: `i18n:extract` now runs `lingui extract --clean`
  (strips the obsolete entries before compile), and all three release/sync scripts
  guard the `en` catalog — they abort/warn if it still contains "Anarlog" or is
  missing a fork key (`nbfdhU VrNltZ iDNBZe LMUw1U Gzw2pq 9cDpsw`):
  - `local-release.sh` — hard abort before building.
  - `rebase-on-main.sh` / `sync-upstream.sh` — warn on missing fork keys / shrink.
- **Catalogs are regenerated, not reverted.** The earlier fix reverted to the
  committed 529-entry `en`; the current catalogs are regenerated from source via
  `extract --clean` + `compile`, which also added the fork-added sections and
  removed dead/obsolete entries. Keep `i18n:extract` as `--clean`; do NOT switch it
  back to incremental, or the Anarlog trap returns on the next compile.

## Verification
- `pnpm -F desktop test src/i18n/catalogs.test.ts` → pass.
- `pnpm smoke` → app boots, i18n initializes without error.
