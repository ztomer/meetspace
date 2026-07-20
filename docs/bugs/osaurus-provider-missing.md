# Bug: Osaurus provider missing from LLM picker

**Severity:** Medium — fork's intended default local provider is invisible.
**Status:** Fixed. Proof: `src/settings/ai/shared/local-providers.test.ts`.

## Symptom
The provider dropdown in Settings → AI → LLM does not list **Osaurus**
(the fork's intended default local provider at `http://localhost:1337/v1`),
even though `docs/FORK_PLAN.md` and `docs/SYNCING.md` state it should be
the default local provider.

## Root cause
Osaurus was **never actually added** to the LLM provider array. It exists only
in:
- the allowlist `apps/desktop/src/settings/ai/shared/local-providers.ts:15` (`"osaurus"`)
- the guard test `local-providers.test.ts:30,33`
- the docs (FORK_PLAN.md, COMMERCIAL_FEATURES.md, SYNCING.md:118)
- a stray reference in `prep-card.tsx:569`

The real provider list is a single `_PROVIDERS` array in
`apps/desktop/src/settings/ai/llm/shared.tsx:38`, exported raw at `:184`
(`export const PROVIDERS = sortProviders(_PROVIDERS)`) with **no `osaurus`
entry**. `git log -S '"osaurus"' -- .../llm/shared.tsx` returns nothing — it was
never implemented, not renamed/dropped by the rebrand sweep.

The guard test only asserts the weak direction (each shown provider is in the
allowlist), so it passes while osaurus is silently absent.

## Affected files
- `apps/desktop/src/settings/ai/llm/shared.tsx` — provider list definition
- `apps/desktop/src/settings/ai/llm/select.tsx:22,89,526` — renders `PROVIDERS`
- `apps/desktop/src/settings/ai/llm/configure.tsx:6,25,31` — renders `PROVIDERS`

## Fix direction
Add an `osaurus` entry to the provider list (`baseUrl: http://localhost:1337/v1`),
mirroring how STT wired its fork provider (`stt/shared.tsx`). Strengthen
`local-providers.test.ts` to assert `osaurus ∈ PROVIDERS`.

## Verification
- Open Settings → AI → LLM → provider dropdown → Osaurus present and selectable.
- `pnpm -F desktop test local-providers` passes with the strengthened assertion.
