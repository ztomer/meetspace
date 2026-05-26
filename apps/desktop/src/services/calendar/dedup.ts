/**
 * Phase 10.3 — cross-provider event deduplication.
 *
 * The same logical event often appears via multiple calendar providers
 * (e.g. Apple Calendar mirrors a Google account AND the user signed into
 * Google directly via OAuth). Without dedup the sidebar agenda shows the
 * event twice. We group events by a coarse key (rounded start, rounded
 * end, normalized title), then keep one row per group based on the
 * user's `calendar_provider_precedence` setting.
 *
 * The key is intentionally fuzzy because providers disagree on:
 *  - timezone normalization (Apple's CalDAV vs Google's RFC3339)
 *  - title casing / trailing whitespace
 *  - +/- 1s on start/end timestamps because of conversion through DB roundtrips
 *
 * `iCalUID` would be the ideal match but isn't reliably surfaced for Apple
 * events through the plugin; if a future Apple-side change exposes it, plug
 * it in here as a first-pass match before falling back to the heuristic.
 */

const ROUND_MS = 5 * 60 * 1000; // 5-minute bucket — 1 minute was too tight (saw drift), 10 was too loose

export type EventLike = {
  provider?: string;
  title?: string;
  started_at?: string;
  ended_at?: string;
};

export type EventRow<T extends EventLike = EventLike> = {
  id: string;
  data: T;
};

/** Result: the set of event IDs that should be HIDDEN as duplicates. */
export function computeDuplicateHiddenSet<T extends EventLike>(
  rows: EventRow<T>[],
  precedence: string[],
): Set<string> {
  const groups = new Map<string, EventRow<T>[]>();
  for (const row of rows) {
    const key = makeKey(row.data);
    if (!key) continue;
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }

  const hidden = new Set<string>();
  for (const bucket of groups.values()) {
    if (bucket.length < 2) continue;
    const winner = pickWinner(bucket, precedence);
    for (const row of bucket) {
      if (row.id !== winner.id) hidden.add(row.id);
    }
  }
  return hidden;
}

/** Parse the JSON-encoded precedence setting, falling back to the default. */
export function parsePrecedence(raw: string | undefined | null): string[] {
  const DEFAULT = ["apple", "google", "outlook"];
  if (!raw) return DEFAULT;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT;
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return DEFAULT;
  }
}

function makeKey(e: EventLike): string | null {
  const start = parseToMs(e.started_at);
  const end = parseToMs(e.ended_at);
  if (start === null || end === null) return null;
  const title = (e.title ?? "").trim().toLowerCase();
  if (!title) return null;
  return `${round(start)}|${round(end)}|${title}`;
}

function parseToMs(s: string | undefined): number | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

function round(ms: number): number {
  return Math.round(ms / ROUND_MS) * ROUND_MS;
}

function pickWinner<T extends EventLike>(
  bucket: EventRow<T>[],
  precedence: string[],
): EventRow<T> {
  // Lower index = higher priority. Anything not in the list is least-preferred.
  const rank = (provider: string | undefined) => {
    if (!provider) return Number.MAX_SAFE_INTEGER;
    const idx = precedence.indexOf(provider);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  };
  return bucket.reduce((best, cur) =>
    rank(cur.data.provider) < rank(best.data.provider) ? cur : best,
  );
}
