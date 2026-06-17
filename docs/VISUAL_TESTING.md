# Visual testing

Every change that alters what the user sees gets verified two ways: a human
(or agent) **looks at it**, then the verified appearance is **locked into a
deterministic snapshot** so it can't silently regress. See the "Visual change
verification" rule in `AGENTS.md`.

## 1. Exploratory pass — look at it as a user

Before landing a visual change, run the real app and walk the scenario it
touches:

```bash
pnpm -F @meetspace/desktop tauri:dev
```

Then capture and judge:
- Screenshot the affected screen in **light and dark** (dark-mode contrast is
  the recurring failure mode here).
- For flows/animations, grab a short screen recording.
- Ask what a user expects vs what's on screen: contrast, overflow, alignment,
  truncation, empty/loading/error states, focus.

The `user-pov-debug` skill automates this loop (drive the app, capture at real
scale, judge against intent, then turn each finding into a test). Use it for
anything visual.

## 2. Deterministic pass — lock it in

Pixel-snapshot harness: Playwright renders the Vite build in headless Chromium
with Tauri IPC mocked, in light and dark.

Current coverage (each light + dark): NotFound, main app shell (empty state),
a populated timeline (seeded sessions), onboarding (first-run permissions), and
all nine Settings sections (App/Appearance, Data, Notifications, Permissions,
Calendar, Contacts, Intelligence, Templates, Integrations). 13 screens, 26
baselines. Extend by seeding more data (see "In-app screens" below).

```bash
pnpm -F desktop visual:install   # one time: download the chromium binary
pnpm -F desktop visual           # run + compare against committed baselines
pnpm -F desktop visual:update    # refresh baselines — always eyeball the diff
```

Layout (`apps/desktop/visual/`):
- `playwright.config.ts` — viewport/DPR/threshold pinned; `light` + `dark`
  projects; starts (or reuses) `pnpm -F desktop dev` on port 1422.
- `support/tauri-mock.ts` — answers `window.__TAURI_INTERNALS__.invoke` with
  safe empties; extend `handlers` as new screens need backend data.
- `support/fixtures.ts` — installs the mock before app code runs.
- `specs/*.spec.ts` — one spec per verified screen/scenario.
- `__snapshots__/` — committed baselines (`*-{light,dark}-{platform}.png`).

### Adding a snapshot

After you've verified a screen by hand, capture it:

```ts
import { expect, test } from "../support/fixtures";

test("settings appearance", async ({ page }) => {
  await page.goto("/app/settings/appearance");      // navigate to it
  await expect(page.getByText("Appearance")).toBeVisible(); // stable state
  await expect(page).toHaveScreenshot("settings-appearance.png", { fullPage: true });
});
```

Run `pnpm -F desktop visual:update` to write the light+dark baselines, review
them, commit.

### In-app screens

`/app/*` routes render under the headless mock — the main shell empty state is
snapshotted in `specs/app-shell.spec.ts`. The mock answers every Tauri command
with safe empties, so sessions/notes/chat come up **empty** (the persisters
have no files to load — those errors in the log are caught and harmless).

That covers empty/first-run states. Screens that need **existing data** are
seeded through the filesystem-backed persisters. `seedSessions(page, [...])`
(support/app.ts) injects synthetic session `_meta.json` files that the session
persister loads — see `timeline.spec.ts`. The mock's `scan_and_read` handler is
directory-scoped, so seeded files reach only the matching persister. Follow the
same shape to seed chats/events/calendar (return their files for the matching
`scanDir`), or extend `seedSessions` with notes/transcripts/participants.

Per-test command overrides: `mockCommands(page, { some_command: value })`
before navigation (see `onboarding.spec.ts`). Values are the raw `invoke`
return; specta bindings wrap them into `{ status: "ok", data }`.

Determinism notes: the clock is frozen (`support/fixtures.ts` → `FIXED_TIME`)
so on-screen times don't drift; animations are disabled at screenshot time.
If a screen shows other live/random values, stub them in the mock.

### Baselines & CI

Baselines are platform-suffixed (`-darwin`, `-linux`). Generate them on the
same OS that compares them — locally that's macOS; if visual runs in CI, add
Linux baselines from a CI run (or a Playwright Docker image) so they match.
