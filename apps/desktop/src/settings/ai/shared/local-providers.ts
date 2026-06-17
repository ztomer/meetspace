// Fork policy: this is a local-first build with no cloud providers. We achieve
// that by HIDING cloud providers, not deleting them — keep upstream's full
// provider lists/types intact (so upstream syncs merge cleanly) and gate what
// the UI surfaces through these allowlists. Anything not listed here is hidden.
//
// At sync time: take upstream's `_PROVIDERS` wholesale; do NOT trim the array.
// The widened provider type keeps upstream's enhance/provider code type-checking,
// and `keepLocalProviders` ensures only these ids ever reach the user. To allow
// a new local provider, add its id here — that's the entire fork delta.
//
// `custom` is intentionally allowed: it's the user's own OpenAI-compatible
// endpoint (BYO), not a hosted/branded cloud provider.

export const LOCAL_LLM_PROVIDER_IDS = [
  "osaurus",
  "ollama",
  "lmstudio",
  "custom",
] as const;

export const LOCAL_STT_PROVIDER_IDS = ["meetspace"] as const;

export function keepLocalProviders<T extends { id: string }>(
  providers: readonly T[],
  allowedIds: readonly string[],
): T[] {
  const allowed = new Set<string>(allowedIds);
  return providers.filter((p) => allowed.has(p.id));
}
