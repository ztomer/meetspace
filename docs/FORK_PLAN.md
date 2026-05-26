# Anarlog Local-Only Fork — Plan

Goal: turn Anarlog into a fully local desktop app with all commercial features either enabled, replaced with local equivalents, or honestly hidden. Maintain rebase-ability against upstream `main`.

**Branch:** `MIT_BACK` (will be renamed). **Never push to the `anarlog` origin.** A new origin will be added later.

## Status

| Phase | Status |
|---|---|
| 0. Document commercial surface | ✅ Done |
| 1. Rip out auth/billing/Supabase | ✅ Done — backend dirs deleted, deps dropped, rebase recipe at [_REMOVED_AUTH.md](_REMOVED_AUTH.md) |
| 2. Remove Pro/account UI | ✅ Done — account tab + profile sign-in + Pro toasts gone. Pro UI in pickers left for Phase 3/3b rewrite. |
| 3. STT picker flatten | ✅ Done — single dropdown, local models only (Soniqo/Parakeet on Apple Silicon, Cactus/Whisper elsewhere). Auto-seeds provider + default model. |
| 3b. LLM picker + Osaurus/Ollama | ✅ Done — providers reduced to Osaurus (default :1337), Ollama, LM Studio, Custom (OpenAI-compatible escape hatch). useLLMConnection collapsed to a single OpenAI-compatible client with an Ollama-Origin shim. |
| 4a. Session export | ✅ Already shipped upstream — Export modal supports PDF/MD/Org/TXT. |
| 4b. Vault export/import | ✅ Done — Storage settings already exposed move/switch upstream; added "Backup now" button that calls existing `copy_vault` Rust command into a user-chosen folder. Restore = Customize dialog with Move unchecked. |
| 4c. Obsidian | ✅ Done — Settings → Integrations → Obsidian, vault picker + subfolder + auto-export toggle. Session overflow menu has "Export to Obsidian". Auto-export now fires on session stop via `services/obsidian-auto-export.ts`. |
| 4e. Notion | ✅ Done — BYO integration token + database id in Settings → Integrations; "Send to Notion" in session overflow menu. |
| 4f. Linear | ✅ Done — BYO API key; first use opens a team picker dialog; "Create Linear issue" in session overflow menu. |
| 4g. Hide OAuth-only integrations | ✅ Done — old `settings/integrations.tsx` was dead code; deleted. New panel created in 4c. |
| 5. Workspace cleanup | ✅ Done — packages/pricing deleted; @hypr/api-client retained for type-only imports (frozen). |
| 6. Rebase tooling | ✅ Done — `scripts/rebase-on-main.sh` + CONTRIBUTING.md fork section. |

**Workflow rule:** Update this Status table and commit after every milestone.

**🎉 Phase 0–6 complete.** The fork is local-only, typecheck-green, and rebase-tooled.

---

## Phase 7 — Rebrand & polish

| # | Item | Status |
|---|---|---|
| 1 | Rename **Anarlog / Hyprnote / @hypr/* / hypr_* / HYPR_* / com.hyprnote.\*** → **Meetspace** everywhere (full sweep including bundle ids, package scope, Rust crate aliases, asset filenames, flatpak manifests, eslint-plugin namespace, runtime constants). | ✅ Done — 3,742 source files rewritten, 22 files / 2 dirs renamed. Excluded historical refs: `docs/FORK_PLAN.md`, `docs/COMMERCIAL_FEATURES.md`, `docs/_REMOVED_AUTH.md`, `packages/changelog/content/*.md`, `apps/api/openapi.gen.json`. Typecheck + cargo check green. |
| 2 | **App icon** — red meat-textured sofa. | ✅ Done — source at `apps/desktop/src-tauri/icons/src/meetspace-source.png`; trimmed + squared to 1024² master at `meetspace-prod.png`; regenerated all PNG sizes, `icon.icns` (16→1024 with @2x), `icon.ico` (multi-res 16→256), Windows Square*Logo.png, JPG for the Apple Icon Composer bundle, in-app asset, generic `public/assets/icon.png`. Stale `resources/stable/Assets.car` deleted so next build regenerates. |
| 3 | **Whisper Large** STT support — surface Whisper Large variants in the local STT picker. | ✅ Done — Argmax-backed models (Whisper Large V3, Parakeet V2/V3) now appear in the Apple Silicon picker alongside Soniqo. One-line filter change in `useLocalModels`. |
| 4 | **Dark mode** via a **centralized theming layer**. | ✅ Done (foundation + sweep) — `theme` setting in tinybase (`system` / `light` / `dark`, default `system`). `useApplyTheme()` hook in `apps/desktop/src/shared/theme.ts` mirrors the choice onto `<html>.dark` + `data-theme`, listens to `prefers-color-scheme` for `system`. Toggle UI at Settings → App → Appearance. Migrated ~800 raw `neutral-*`/`stone-*`/`white`/`black` classes across ~140 files to shadcn semantic tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-muted`, `bg-accent`, `text-destructive`, …) — these now flip automatically when `.dark` is applied. CSS-var palette already shipped by upstream shadcn/ui in `packages/ui/src/styles/globals.css`. **Follow-ups:** ~50 remaining intentional-contrast raw classes (stone-700/800 dark buttons, explicit toast colors) need hand-fixes when surfaced in dark mode; end-to-end visual QA across all dialogs/integrations/onboarding still pending — best done in a dedicated session with the dev app open. |
| 5 | **New origin** = `https://github.com/ztomer/meetspace`. | ✅ Done — `MIT_BACK` pushed as `meetspace/main`. Local `MIT_BACK` tracks `meetspace/main`; local `main` still tracks `origin/main` (upstream) for rebases. |

---

## Phase 0 — Document commercial surface

Deliverable: `docs/COMMERCIAL_FEATURES.md`, cataloguing every Pro/paid feature, where it lives, and what this fork does with it.

Sources to compile from:
- [packages/pricing/src/tiers.ts](../packages/pricing/src/tiers.ts) — Free / Lite / Pro tier definitions
- [apps/desktop/src/auth/billing.tsx](../apps/desktop/src/auth/billing.tsx) — JWT claim parsing
- [apps/desktop/src/settings/ai/shared/eligibility.ts](../apps/desktop/src/settings/ai/shared/eligibility.ts) — `requires_entitlement: "pro"` checks
- [apps/desktop/src/settings/ai/llm/shared.tsx](../apps/desktop/src/settings/ai/llm/shared.tsx) and [stt/shared.tsx](../apps/desktop/src/settings/ai/stt/shared.tsx) — provider registries
- [apps/desktop/src/settings/integrations.tsx](../apps/desktop/src/settings/integrations.tsx) — `MOCK_INTEGRATIONS`
- `apps/api/`, `apps/stripe/`, `apps/web/`, `supabase/` — backend services

For each feature: current state (real / stub), fork decision (enable / replace / hide / delete), implementation status.

---

## Phase 1 — Rip out auth, billing, Supabase

Full removal (per decision). Trade-off accepted: harder rebases when upstream touches auth, in exchange for a clean local-only result.

Steps:
1. Delete `apps/desktop/src/auth/` (`billing.tsx`, `context.tsx`, related).
2. Remove `packages/supabase` from desktop import graph.
3. Replace every `useBillingAccess()` and `useAuth()` call site (~98) with either deletion or trivial constants. Most collapse to dead-code elimination once `billing.isPaid` is a constant `true`.
4. Strip `VITE_PRO_PRODUCT_ID` and Supabase env vars from [apps/desktop/env.ts](../apps/desktop/env.ts) and `.env*`.
5. Delete `apps/api/`, `apps/stripe/`, `supabase/`, and (likely) `apps/web/`. Remove from `pnpm-workspace.yaml`.
6. Maintain `docs/_REMOVED_AUTH.md` listing removed files + line counts. When rebases conflict on auth, this is the recipe for re-removal.

---

## Phase 2 — Remove account/billing/Pro UI

- Unmount the "Account" tab from settings tab registry; delete `apps/desktop/src/settings/general/account.tsx`.
- Delete sign-in section from [apps/desktop/src/sidebar/profile/auth.tsx](../apps/desktop/src/sidebar/profile/auth.tsx).
- Remove the onboarding "account" step (`apps/desktop/src/onboarding/account/`).
- Scrub UI strings: "Pro", "Upgrade", "Plan", "Trial", "Free tier", "Lite", "Anarlog cloud". Remove "Recommended" / "Pro (Cloud)" badges from provider entries.
- Remove tier pricing UI fed by `packages/pricing`. The package itself can stay un-imported or be deleted.
- Remove paid-feature toasts in [apps/desktop/src/sidebar/toast/registry.tsx](../apps/desktop/src/sidebar/toast/registry.tsx) (`hasProSttConfigured`, `hasProLlmConfigured`).

---

## Phase 3 — STT picker: flat local-models list

Goal: no "provider" abstraction. One dropdown listing locally-runnable transcription models.

Files: [apps/desktop/src/settings/ai/stt/shared.tsx](../apps/desktop/src/settings/ai/stt/shared.tsx), [select.tsx](../apps/desktop/src/settings/ai/stt/select.tsx).

Changes:
- Delete the `hyprnote` cloud provider entry.
- Delete all external cloud providers (`deepgram`, `openai`, `gladia`, `soniox`, `elevenlabs`, `mistral`, `aquavoice`, `assemblyai`, "custom").
- Build a flat model registry sourced from `plugins/local-stt` Tauri commands (`list_supported_models`, `is_model_downloaded`, `download_model`, `start_server`, etc.):
  - **Parakeet TDT 0.6B V3** (Soniqo backend, Apple Silicon, realtime)
  - **Faster Whisper Large V3 Turbo**
  - Other Whisper variants exposed by Cactus
- UI: one `<Select>` listing each model with name, size, backend, download state, and a per-row "Download" button.
- Default selection: Parakeet if Apple Silicon, else Whisper Turbo.
- No Rust changes needed.

---

## Phase 3b — LLM picker: local-first with escape hatch

Flatten the LLM picker similarly. Default entries:
- **Osaurus** — local OpenAI-compatible server, default `baseUrl: http://localhost:1337`, user-changeable. Auto-detect via `GET /v1/models`.
- **Ollama** — local, default `baseUrl: http://localhost:11434`, auto-detect.
- **llama.cpp / LM Studio** — local, manual URL.
- **Custom OpenAI-compatible** — BYO baseUrl + optional API key. This is the escape hatch for users who want cloud LLMs (OpenRouter, Anthropic via proxy, etc.) without us shipping vendor UI.

All four share one OpenAI-compatible HTTP client. Model lists fetched from `/v1/models`.

Files: [apps/desktop/src/settings/ai/llm/shared.tsx](../apps/desktop/src/settings/ai/llm/shared.tsx) and the LLM picker components alongside it.

---

## Phase 4 — Replace stub Pro features with local equivalents

### 4a. Session export to file
- Tauri `dialog::save` → write markdown / HTML / PDF of a session (transcript + notes).
- TipTap-to-markdown serializer for the notes; transcript already exists as structured data.
- Replaces "Shareable Links".

### 4b. Vault export / import
- Export: zip TinyBase store + audio files to a user-chosen folder.
- Import: restore from same zip (with merge/overwrite prompt).
- Users sync vaults manually via Dropbox / iCloud / git.
- Replaces "Cloud Sync".

### 4c. Obsidian integration
- Settings: pick **default Obsidian vault folder** (Tauri `dialog::open`, persisted in TinyBase) and **default subfolder** within the vault (e.g. `Anarlog/`).
- Action: **explicit** "Export to Obsidian" button on each session. Writes `<vault>/<subfolder>/<YYYY-MM-DD>-<title>.md` with YAML frontmatter (date, attendees, tags, source = anarlog).
- Toggle: "Auto-export new sessions to Obsidian" (off by default). When on, fires the same action on session finalize.
- No API. Pure filesystem writes via Tauri `fs`.

### 4d. Osaurus / Ollama
- Implemented as LLM providers in Phase 3b, not in the integrations panel.

### 4e. Notion export (BYO-token)
- Settings: Notion integration token + target database ID.
- Action: "Export to Notion" creates a page in the target database with session content.

### 4f. Linear (BYO-token)
- Settings: Linear API key.
- Action: "Create Linear issue from session" — POST to Linear GraphQL with session title + transcript link.

### 4g. Hidden integrations
- Slack, Discord, GitHub, Jira — hide with a single explanatory line: "OAuth-based integrations are not available in the local fork." Or just delete from the panel.

---

## Phase 5 — Workspace cleanup

- Remove deleted app directories from `pnpm-workspace.yaml`.
- Update root `package.json` scripts; drop any references to api/stripe/web.
- `pnpm exec dprint fmt`, `pnpm -r typecheck`, `cargo check` must pass.
- Update [README.md](../README.md) to describe the local-only fork.

---

## Phase 6 — Rebase tooling

- `scripts/rebase-on-main.sh`:
  - `git fetch upstream`
  - `git rebase upstream/main`
  - Re-`git rm` any auth/billing/supabase files upstream reintroduces (list maintained in `docs/_REMOVED_AUTH.md`).
  - Run `pnpm -F desktop typecheck` and `cargo check`; fail loud on signature drift in eligibility / billing helpers (so we notice when upstream changes gate shapes).
- Add a "Maintaining the fork" section to `CONTRIBUTING.md`.
- **Origin discipline:** the existing `origin` remote points at upstream `anarlog`. Do not push. New origin will be added later by the user; only push then.

---

## Execution order & estimates

| Phase | Scope | Est. |
|---|---|---|
| 0 | Document commercial surface | 0.5d |
| 1 | Rip out auth/billing/Supabase | 3–4d |
| 2 | Remove Pro/account UI | 1–2d |
| 3 | STT picker flatten | 1d |
| 3b | LLM picker flatten + Osaurus/Ollama | 1d |
| 4a | Session export | 1d |
| 4b | Vault export/import | 2d |
| 4c | Obsidian | 1d |
| 4e | Notion | 1–2d |
| 4f | Linear | 1d |
| 5 | Workspace cleanup | 0.5d |
| 6 | Rebase tooling | 0.5d |

**Total:** ~2.5 weeks of focused work. Integrations are the swingiest.

---

## Open items / future

- Replace "Anarlog" branding throughout once a new project name is chosen.
- Consider deleting `packages/pricing/` entirely once nothing imports it.
- Consider whether `legacy/` and `examples/` directories are still relevant.
- Decide on a new origin remote name and push target.
