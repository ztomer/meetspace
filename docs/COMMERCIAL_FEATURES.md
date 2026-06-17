# Commercial Features Inventory

Snapshot of every commercial/paid surface in [upstream Anarlog](https://github.com/fastrepl/anarlog), with the Meetspace fork's disposition.

**Legend** — Fork decision:
- **Enable** — already implemented upstream, just gated. Ungate.
- **Replace** — stub upstream; we'll ship a local equivalent.
- **Hide** — stub or cloud-only; we hide the UI and document it as unavailable.
- **Delete** — backend infra we don't need at all.

---

## 1. Pricing tiers

Defined in [packages/pricing/src/tiers.ts](../packages/pricing/src/tiers.ts).

| Tier | Price | Defining features |
|---|---|---|
| Free | $0 | On-device STT, audio recording, BYO key, exports, templates, shortcuts, chat |
| Lite | $8/mo | + Cloud STT/LLM, speaker ID (partial) |
| Pro | $25/mo ($250/yr) | + Playback rates, integrations, advanced templates, cloud sync, shareable links |

**Fork decision: Delete.** `packages/pricing` will be un-imported. The tier UI is removed in Phase 2.

---

## 2. Entitlement gates (code)

| File:line | Gate | Disposition |
|---|---|---|
| [apps/desktop/src/auth/billing.tsx:89](../apps/desktop/src/auth/billing.tsx) | `BillingInfo` derived from Supabase JWT claims (`entitlements`, `subscription_status`, `trial_end`) | **Delete** — entire file removed in Phase 1 |
| [apps/desktop/src/settings/ai/shared/eligibility.ts:9](../apps/desktop/src/settings/ai/shared/eligibility.ts) | `requiresEntitlement()` helper | **Delete** the `requires_entitlement` arm; collapse `ProviderRequirement` union |
| `apps/desktop/src/settings/ai/llm/shared.tsx` | `hyprnote` LLM provider requires auth + entitlement `"pro"` *(legacy upstream provider id)* | **Delete** the provider entry (Phase 3b) |
| [apps/desktop/src/sidebar/toast/registry.tsx](../apps/desktop/src/sidebar/toast/registry.tsx) | `hasProSttConfigured`, `hasProLlmConfigured` toasts | **Delete** toasts (Phase 2) |
| `apps/desktop/src/shared/config/configure-paid-settings.ts` | Auto-configures Pro STT/LLM when entitlement appears | **Delete** (Phase 1) |

---

## 3. Account / billing UI

| Surface | Location | Disposition |
|---|---|---|
| Account settings tab | [apps/desktop/src/settings/general/account.tsx](../apps/desktop/src/settings/general/account.tsx) | **Delete** + unmount from tab registry (Phase 2) |
| Profile menu sign-in | [apps/desktop/src/sidebar/profile/auth.tsx](../apps/desktop/src/sidebar/profile/auth.tsx) | **Delete** the auth section |
| Onboarding account step | `apps/desktop/src/onboarding/account/` | **Delete** (Phase 2) |
| Trial dialogs | `apps/desktop/src/billing/trial-{started,ended}-dialog.tsx` | **Delete** (Phase 1, dragged out with billing.tsx) |
| Upgrade/Checkout deep links | `buildWebAppUrl("/app/checkout")`, `/app/portal` | **Delete** with `apps/web` workspace |

---

## 4. STT providers

Source: [apps/desktop/src/settings/ai/stt/shared.tsx](../apps/desktop/src/settings/ai/stt/shared.tsx).

| Provider ID | Type | Disposition |
|---|---|---|
| `hyprnote` | upstream cloud STT | **Delete** |
| `deepgram`, `assemblyai`, `openai`, `gladia`, `soniox`, `elevenlabs`, `mistral`, `aquavoice`, `fireworks`, `custom` | Cloud BYO-key | **Delete** (local-only fork, per decision) |
| `pyannote` | Local (Parakeet + Faster Whisper) | **Keep**, flatten under new local-models picker |

**Replacement** (Phase 3): flat list of locally-runnable models sourced from `SUPPORTED_MODELS` in [crates/local-stt-core/src/lib.rs](../crates/local-stt-core/src/lib.rs):

- Soniqo: ParakeetStreaming, ParakeetBatch
- Argmax: ParakeetV2, ParakeetV3, WhisperLargeV3
- Cactus: WhisperSmallInt4 / Int4Apple / Int8 / Int8Apple
- Cactus: ParakeetTdt0_6bV3Int4 / Int4Apple / Int8 / Int8Apple

Exposed via `plugins/local-stt` Tauri commands: `list_supported_models`, `is_model_downloaded`, `download_model`, `delete_model`, `start_server`, `get_server_for_model`.

---

## 5. LLM providers

Source: [apps/desktop/src/settings/ai/llm/shared.tsx](../apps/desktop/src/settings/ai/llm/shared.tsx).

| Provider ID | Type | Disposition |
|---|---|---|
| `hyprnote` | upstream cloud LLM (Pro entitlement) | **Delete** |
| `lmstudio`, `ollama` | Local OpenAI-compatible | **Keep** |
| `openrouter`, `openai`, `anthropic`, `mistral`, `azure_openai`, `azure_ai`, `google_generative_ai` | Cloud BYO-key | **Delete** (covered by Custom OpenAI-compatible escape hatch) |
| `custom` | Manual baseUrl + key | **Keep** as escape hatch |

**Additions** (Phase 3b):
- **Osaurus** — new entry, default `baseUrl: http://localhost:1337`, user-configurable. Auto-detect via `GET /v1/models`.
- Reorder defaults: Osaurus > Ollama > LM Studio > Custom.

---

## 6. Integrations panel

Source: [apps/desktop/src/settings/integrations.tsx](../apps/desktop/src/settings/integrations.tsx). All entries are `MOCK_INTEGRATIONS` with `console.log` connect/sync handlers — zero backend.

| Integration | Type | Disposition |
|---|---|---|
| Slack | OAuth | **Hide** — needs OAuth callback server |
| Notion | API token | **Replace** — Phase 4e (BYO-token) |
| Discord | OAuth | **Hide** |
| Linear | API key | **Replace** — Phase 4f (BYO-token) |
| GitHub | OAuth | **Hide** |
| Jira | OAuth | **Hide** |
| **Obsidian** (new) | Local filesystem | **Replace/Add** — Phase 4c (vault folder + subfolder, explicit + auto-export toggle) |

---

## 7. Cloud sync & shareable links

Both are pure UI stubs (no client code, no endpoint hits).

| Feature | Disposition | Local replacement |
|---|---|---|
| Cloud Sync | **Replace** | Phase 4b — vault export/import (zip of TinyBase + audio). Manual sync via Dropbox/iCloud/git. |
| Shareable Links | **Replace** | Phase 4a — session export to file (markdown/HTML/PDF via Tauri save dialog). |

---

## 8. Backend services

| Service | Purpose | Disposition |
|---|---|---|
| `apps/api/` | Rust API validating JWT entitlements, `canStartTrial` endpoint | **Delete** (Phase 5) |
| `apps/stripe/` | Bun + Stripe webhook listener, syncs Supabase | **Delete** |
| `apps/web/` | Netlify-deployed marketing + checkout/portal | **Delete** |
| `supabase/` | DB migrations, auth, billing schema | **Delete** |
| `packages/supabase` | JS client + `deriveBillingInfo` | **Delete** (after Phase 1 removes desktop imports) |
| `packages/pricing` | Tier definitions | **Delete** |

---

## 9. Env vars to remove

From [apps/desktop/env.ts](../apps/desktop/env.ts) and `.env*`:

- `VITE_PRO_PRODUCT_ID`
- `VITE_API_URL`
- `VITE_WEB_URL` (if only used for `/app/checkout` etc.)
- Any `VITE_SUPABASE_*`

---

## 10. Files maintained for rebase hygiene

- [docs/FORK_PLAN.md](FORK_PLAN.md) — the plan.
- `docs/_REMOVED_AUTH.md` — created in Phase 1, lists every file/import we removed so re-applying after an upstream auth refactor is mechanical.
- `scripts/rebase-on-main.sh` — re-runs the deletions and validates with typecheck + cargo check.

