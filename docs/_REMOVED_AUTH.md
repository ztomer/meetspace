# Removed Auth / Billing / Backend — Rebase Recipe

When rebasing on upstream `main`, anything in this list that upstream reintroduces should be **re-removed**. Keep this file in lock-step with the actual fork state.

## Deleted directories

- `apps/api/` — Rust backend (JWT validation, canStartTrial)
- `apps/stripe/` — Stripe webhook listener
- `apps/web/` — Netlify marketing + checkout/portal site
- `supabase/` — DB migrations, auth, billing schema
- `packages/supabase/` — JS Supabase client + `deriveBillingInfo`
- `apps/desktop/src/billing/` — trial dialogs
- `apps/desktop/src/onboarding/account/` — login + trial onboarding step

## Deleted desktop files

- `apps/desktop/src/auth/client.ts` — Supabase client factory
- `apps/desktop/src/auth/errors.ts` — fatal-session detection
- `apps/desktop/src/shared/config/configure-paid-settings.ts`
- `apps/desktop/src/stt/useUploadAudio.ts` — Supabase Storage uploads

## Replaced files (no longer Supabase-aware)

- `apps/desktop/src/auth/context.tsx` — synthetic `useAuth` returning null session
- `apps/desktop/src/auth/billing.tsx` — synthetic `useBillingAccess` returning always-paid
- `apps/desktop/src/auth/useConnections.ts` — empty `ConnectionItem[]`
- `apps/desktop/src/onboarding/calendar.tsx` — Apple Calendar only
- `apps/desktop/src/onboarding/{index,config}.tsx` — no login step
- `apps/desktop/src/sidebar/devtool.tsx` — no BillingCard
- `apps/desktop/src/sidebar/profile/index.tsx` — facehash-only avatar

## Dependency drops (apps/desktop/package.json)

- `@hypr/supabase` (workspace dep)
- `@supabase/supabase-js`
- `stripe` (devDep)

## Dependency drops (root package.json)

- `@infisical/cli`
- `supabase` CLI devDep

## Workspace / build drops

- `pnpm-workspace.yaml`: removed `supabase`, `@infisical/cli`, `netlify`, `puppeteer` from `allowBuilds`
- `Taskfile.yaml`: removed all `supabase*`, `stripe`, `nango-dev-*`, web include
- `.infisical.json`, `doxxer.api.toml`, `doxxer.cli.toml`, `doxxer.stripe.toml`, `doxxer.web.toml`, `openstatus.lock`, `openstatus.yaml`, `render.yaml`, `bitrise.yml`

## Env vars stripped (apps/desktop/src/env.ts)

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_PRO_PRODUCT_ID`
- `VITE_API_URL` is kept as `""` default temporarily — last call sites removed in Phase 3/3b.

## Pending (later phases)

- `@hypr/api-client` workspace dep — still imported for `ConnectionItem`, `CharTask` types and `startTrial`/`createClient`. To be dropped in Phase 2 after `settings/general/account.tsx` is removed and types are inlined.
- `@hypr/pricing` workspace dep — to be dropped in Phase 2 when tier UI is removed.
- `packages/api-client/`, `packages/pricing/` directories — delete in Phase 5 workspace cleanup.

## When rebasing

If upstream reintroduces any file/dir in this list, re-delete it. If upstream changes `auth/context.tsx` or `auth/billing.tsx`, take their changes and re-apply our synthetic stub (the public API of `useAuth` / `useBillingAccess` is what callers depend on — keep field names compatible).
