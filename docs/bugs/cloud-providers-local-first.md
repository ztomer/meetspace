# Bug: Cloud providers shown instead of local-first

**Severity:** Medium — violates the fork's "local first" principle.
**Status:** Fixed. Proof: `src/settings/ai/shared/local-providers.test.ts`.

## Symptom
The LLM provider picker shows multiple cloud providers (OpenAI, Anthropic,
Mistral, Azure OpenAI, Azure AI, Google Generative AI, OpenRouter,
Cloudflare Workers AI) instead of a local-first list.

## Root cause
The LLM provider list was never wired to the fork's local-first filter that
STT uses. The intended design (`docs/SYNCING.md:110-123`) requires the LLM
`PROVIDERS` to pass through `keepLocalProviders(..., LOCAL_LLM_PROVIDER_IDS)`,
exactly like STT does at `apps/desktop/src/settings/ai/stt/shared.tsx:77-79`.

But `apps/desktop/src/settings/ai/llm/shared.tsx:184` exports the raw
`sortProviders(_PROVIDERS)` with **no filter**, so all 12 providers render.

Current raw list (`shared.tsx:38-182`):
`meetspace`, `lmstudio`, `ollama`, `openrouter`, `openai`,
`cloudflare_workers_ai`, `anthropic`, `mistral`, `azure_openai`, `azure_ai`,
`google_generative_ai`, `custom`.

The allowlist + filter exist and work (`shared/local-providers.ts:14,23`) and
STT proves the pattern — only LLM `shared.tsx` was left as a plain upstream
array. The guard test asserts the weak direction, so it passed.

## Affected files
- `apps/desktop/src/settings/ai/llm/shared.tsx` — missing `keepLocalProviders`
- `apps/desktop/src/settings/ai/share/local-providers.ts` — allowlist (correct)
- Renderers: `select.tsx`, `configure.tsx`

## Fix direction
Split `_PROVIDERS` into `_UPSTREAM_PROVIDERS` + `_FORK_PROVIDERS` (incl. osaurus
from the sibling bug), then:
`export const PROVIDERS = sortProviders(keepLocalProviders([..._UPSTREAM_PROVIDERS, ..._FORK_PROVIDERS], LOCAL_LLM_PROVIDER_IDS));`
Expected result: `osures`, `ollama`, `lmstudio`, `custom` (cloud providers hidden).

## Verification
- Settings → AI → LLM → only local providers listed.
- `pnpm -F desktop test local-providers` asserts `PROVIDERS` ⊆ allowlist.
