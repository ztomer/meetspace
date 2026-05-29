# Rebase Recipe — files & dirs that must stay deleted

When rebasing on upstream, anything in this list that upstream reintroduces should be **re-removed**. `scripts/rebase-on-main.sh` automates this — keep the lists below in lock-step with the script's `REMOVED_DIRS` / `REMOVED_FILES` / `REMOVED_GLOBS` arrays.

## Deleted directories

Phase 1 — auth / billing / cloud backend:
- `apps/api/` — Rust backend (JWT validation, canStartTrial)
- `apps/stripe/` — Stripe webhook listener
- `apps/web/` — Netlify marketing + checkout/portal site
- `supabase/` — DB migrations, auth, billing schema
- `packages/supabase/` — JS Supabase client + `deriveBillingInfo`
- `packages/pricing/` — tier definitions (orphaned after Phase 2 removed all tier UI)
- `apps/desktop/src/billing/` — trial dialogs
- `apps/desktop/src/onboarding/account/` — login + trial onboarding step

Phase 7 rebrand — upstream's CI + release infrastructure:
- `.github/workflows/` — ~40 workflows for stripe/web/api/slack/bot/db/chrome/etc. (services we deleted)
- `.github/actions/` — custom composite actions used by those workflows
- `.github/scripts/` — CI helper scripts (content-audit, grammar-check, slop-check)
- `.github/reports/` — upstream legal-review audit reports
- `scripts/s3/` — upstream's S3 release-artifact pipeline

## Deleted desktop files

Phase 1:
- `apps/desktop/src/auth/client.ts` — Supabase client factory
- `apps/desktop/src/auth/errors.ts` — fatal-session detection
- `apps/desktop/src/shared/config/configure-paid-settings.ts`
- `apps/desktop/src/stt/useUploadAudio.ts` — Supabase Storage uploads

Phase 2:
- `apps/desktop/src/settings/general/account.tsx`
- `apps/desktop/src/sidebar/profile/auth.tsx`

Phase 4g:
- `apps/desktop/src/settings/integrations.tsx` — old mocked panel; replaced by `settings/integrations/`
- `apps/desktop/src/settings/shared.tsx` — `ConnectedServiceCard` only used by the old panel

## Deleted infrastructure configs (repo root)

- `.infisical.json`
- `doxxer.api.toml`, `doxxer.cli.toml`, `doxxer.stripe.toml`, `doxxer.web.toml`
- `openstatus.lock`, `openstatus.yaml`
- `render.yaml`, `bitrise.yml`
- `scripts/download_releases.sh` (CrabNebula release downloader)
- `.github/AGENTS.md` (CI workflow style notes)

## Deleted historical content (Phase 7)

- `packages/changelog/content/1.*.md` — 30 upstream Anarlog 1.0.X release notes. Replaced with our own `0.1.0.md`.
- (Glob: `packages/changelog/content/0.0.*.md` if upstream ever ships those.)

## Replaced files (no longer Supabase-aware)

These exist locally but their internals are forked. Upstream conflicts here need manual merging — take upstream's new behavior and re-apply our synthetic stubs (the public APIs of `useAuth` / `useBillingAccess` are what callers depend on, keep field names compatible).

- `apps/desktop/src/auth/context.tsx` — synthetic `useAuth` returning null session
- `apps/desktop/src/auth/billing.tsx` — synthetic `useBillingAccess` returning always-paid
- `apps/desktop/src/auth/useConnections.ts` — empty `ConnectionItem[]`
- `apps/desktop/src/onboarding/calendar.tsx` — Apple Calendar only
- `apps/desktop/src/onboarding/{index,config}.tsx` — no login step
- `apps/desktop/src/sidebar/devtool.tsx` — no BillingCard
- `apps/desktop/src/sidebar/profile/index.tsx` — facehash-only avatar

## Dependency drops

`apps/desktop/package.json`:
- `@hypr/supabase` (workspace) → renamed to `@meetspace/*` scope
- `@supabase/supabase-js`
- `stripe` (devDep)
- `@hypr/pricing` (workspace)

Root `package.json`:
- `@infisical/cli`
- `supabase` CLI devDep

## Workspace / build drops

- `pnpm-workspace.yaml`: removed `supabase`, `@infisical/cli`, `netlify`, `puppeteer` from `allowBuilds`
- `Taskfile.yaml`: removed all `supabase*`, `stripe`, `nango-dev-*`, web include
- `go.mod`: `module hyprnote` → `module meetspace`

## Env vars stripped (`apps/desktop/src/env.ts`)

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_PRO_PRODUCT_ID`
- `VITE_API_URL` kept as `""` default — all callers now noop, kept for type compat

## When rebasing — the manual conflict cases

The script handles re-deletions automatically. These need your eyes:

1. **`auth/context.tsx` / `auth/billing.tsx`** — if upstream changes the `useAuth`/`useBillingAccess` API shape, the synthetic stub needs the same fields. Most call sites just consume `session`, `isPaid`, `isPro`.
2. **`apps/desktop/src/settings/ai/{stt,llm}/select.tsx`** — we flattened the picker. If upstream adds a new provider, you'll see it as a conflict; decide whether to keep it (cloud BYO-key) or drop (sticking to local-only).
3. **`apps/desktop/src/shared/main/index.tsx`** — we changed `bg-white` → `bg-background` on the StandardTabWrapper. Upstream sometimes refactors this; keep the token.
4. **`plugins/windows/src/window/v1.rs`** — we changed `.theme(Some(tauri::Theme::Light))` → `.theme(None)`. Upstream might re-add the override; keep ours so OS theme detection works.
5. **The Rust workspace alias prefix** — anywhere upstream re-introduces `hypr-X` / `hypr_X` references that our sweep changed to `meetspace-X` / `meetspace_X`. Should be picked up by typecheck/cargo-check after the rebase.
6. **Subtree Squashing Quirks (Vendor directories)** — Git interactive rebasing of squashed subtree vendor dependencies (such as `./vendor/async-openai/` and `./vendor/gbnf-validator/`) merges them into the repository root, creating root-level file conflicts. It can also mistakenly replace the root `README.md` with a symlink pointing to `async-openai/README.md`.
   - *Resolution*: Checkout the clean workspace root configurations (`.gitignore`, `Cargo.toml`, etc.) from your target rebase head. If `README.md` is a symlink, delete it (`rm README.md`) and recreate it as a regular file. Restore the correct `./vendor/` directories using `git checkout <pre-rebase-backup-commit> -- vendor/`. Discard vendor package readme alterations via `git checkout HEAD -- async-openai/README.md`.
7. **Absolute Stale Target Caches** — Tauri build cache directories (`apps/desktop/src-tauri/target/` and the root `target/`) cache absolute path states from older workspaces (e.g. `/Users/ztomer/Projects/anarlog`). This causes release builds to fail due to missing or mismatched autogenerated swift-rs or command TOML templates.
   - *Resolution*: Delete the stale target directories before compiling: `rm -rf apps/desktop/src-tauri/target` and run `cargo clean`.
8. **Compile-Time Env Var Blockages** — Upstream checks for `POSTHOG_API_KEY` and `VITE_API_URL` using `env!` which halts optimized production compiles when they are absent.
   - *Resolution*: Maintain safe `option_env!` shims and fallbacks in `tauri-plugin-analytics`, `tauri-plugin-todo`, and `tauri-plugin-calendar` so that the offline-ready app packages perfectly without remote dependencies.

## Renamed everywhere (Phase 7.1)

This sweep won't auto-reapply on rebase; expect manual conflict work whenever upstream touches branding strings or the workspace scope.

- `Anarlog` / `anarlog` / `ANARLOG` → `Meetspace` / `meetspace` / `MEETSPACE`
- `Hyprnote` / `hyprnote` / `HYPRNOTE` → `Meetspace` / `meetspace` / `MEETSPACE`
- `@hypr/` (JS scope) → `@meetspace/`
- `hypr-` (Cargo workspace aliases) → `meetspace-`
- `hypr_` (Rust use stmts, identifiers) → `meetspace_`
- `HYPR_` (constants, env vars) → `MEETSPACE_`
- `com.hyprnote.*` (bundle ids) → `com.meetspace.*`

`/tmp/rename-to-meetspace.sh` from the original Phase 7.1 commit can be re-run on a conflicted file if upstream re-introduces the old names in bulk.
