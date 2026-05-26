/**
 * Phase 10.1 — TS-side Google Calendar sync.
 *
 * Bypasses the Rust runtime entirely for Google. Reads tokens from tinybase
 * settings, calls the Google Calendar v3 REST API via @tauri-apps/plugin-http,
 * upserts rows into the local `calendars` and `events` tables in the same
 * shape Apple Calendar produces — so the existing sidebar agenda widget
 * picks them up with no UI changes.
 *
 * - Token refresh on 401 via the existing `refresh()` helper.
 * - Sliding window: 7 days back, 30 days forward (matches Apple sync).
 * - Per-calendar `enabled` flag is honored — only fetches events for
 *   calendars the user toggled on in the calendar selector.
 * - Stale events (in window, in our DB, not in upstream response) get
 *   pruned. Stale calendars (in our DB with provider=google, not in
 *   upstream list) get pruned too — including their events.
 */

import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { Store } from "tinybase/with-schemas";

import type { CalendarStorage, EventStorage } from "@meetspace/store";

import {
  isExpired,
  refresh as refreshToken,
  type StoredTokens,
} from "~/integrations/oauth-providers";

// Looser store types so callers holding either the React-hook flavor
// (Store<Schemas>) or the merged flavor (MergeableStore<Schemas>) can pass
// them in without a cast. See services/obsidian-auto-export.ts for the
// same pattern.
// biome-ignore lint/suspicious/noExplicitAny: tinybase generic
type AnyStore = Store<any>;

/** Single logical "connection" — we support one Google account per device. */
const GOOGLE_CONNECTION_ID = "google-default";
const PROVIDER = "google" as const;

type GoogleCalendar = {
  id: string;
  summary?: string;
  summaryOverride?: string;
  primary?: boolean;
  backgroundColor?: string;
};

type GoogleEvent = {
  id: string;
  iCalUID?: string;
  summary?: string;
  description?: string;
  location?: string;
  hangoutLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  status?: string; // "cancelled" → skip
  recurringEventId?: string;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType: string; uri?: string }>;
  };
};

/**
 * Run one sync cycle for Google Calendar. Caller decides cadence. Returns
 * a summary so the UI can show "Last synced …" / error states.
 */
export async function syncGoogleCalendar(args: {
  mainStore: AnyStore;
  settingsStore: AnyStore;
  userId: string;
}): Promise<
  { ok: true; calendars: number; events: number } | { ok: false; error: string }
> {
  const { mainStore, settingsStore, userId } = args;

  const clientId = (
    settingsStore.getValue("google_client_id") as string | undefined
  )?.trim();
  const accessToken = settingsStore.getValue("google_access_token") as
    | string
    | undefined;
  const refreshTok = settingsStore.getValue("google_refresh_token") as
    | string
    | undefined;
  const expiresAt = settingsStore.getValue("google_token_expires_at") as
    | number
    | undefined;

  if (!clientId || !accessToken || !refreshTok) {
    return { ok: false, error: "google calendar not signed in" };
  }

  const tokenState: StoredTokens = {
    accessToken,
    refreshToken: refreshTok,
    expiresAt: expiresAt ?? null,
  };

  // Pre-emptive refresh.
  if (isExpired(tokenState.expiresAt) && tokenState.refreshToken) {
    try {
      const next = await refreshToken(
        "google",
        clientId,
        tokenState.refreshToken,
      );
      persistTokens(settingsStore, next);
      tokenState.accessToken = next.accessToken;
      tokenState.refreshToken = next.refreshToken ?? tokenState.refreshToken;
      tokenState.expiresAt = next.expiresAt;
    } catch (e) {
      return { ok: false, error: `refresh failed: ${(e as Error).message}` };
    }
  }

  const fetchAuthed = async (url: string): Promise<Response> => {
    const doFetch = (token: string) =>
      tauriFetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
    let res = await doFetch(tokenState.accessToken);
    if (res.status === 401 && tokenState.refreshToken) {
      const next = await refreshToken(
        "google",
        clientId,
        tokenState.refreshToken,
      );
      persistTokens(settingsStore, next);
      tokenState.accessToken = next.accessToken;
      tokenState.refreshToken = next.refreshToken ?? tokenState.refreshToken;
      tokenState.expiresAt = next.expiresAt;
      res = await doFetch(next.accessToken);
    }
    return res;
  };

  // 1. Fetch calendar list.
  let calendars: GoogleCalendar[];
  try {
    const res = await fetchAuthed(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList?fields=items(id,summary,summaryOverride,primary,backgroundColor)",
    );
    if (!res.ok) {
      return {
        ok: false,
        error: `calendar list ${res.status}: ${(await res.text()).slice(0, 200)}`,
      };
    }
    const json = (await res.json()) as { items?: GoogleCalendar[] };
    calendars = json.items ?? [];
  } catch (e) {
    return {
      ok: false,
      error: `calendar list failed: ${(e as Error).message}`,
    };
  }

  // 2. Upsert calendars and prune ones that vanished upstream.
  const seenCalendarTrackingIds = new Set<string>();
  const trackingIdToRowId = new Map<string, string>();
  const enabledRowIds = new Set<string>();

  mainStore.transaction(() => {
    for (const cal of calendars) {
      seenCalendarTrackingIds.add(cal.id);
      const name = cal.summaryOverride ?? cal.summary ?? cal.id;
      const existingRowId = findCalendarRowId(mainStore, cal.id);
      const rowId = existingRowId ?? crypto.randomUUID();
      const existing = existingRowId
        ? mainStore.getRow("calendars", existingRowId)
        : null;

      const row: CalendarStorage = {
        user_id: userId,
        created_at:
          (existing?.created_at as string) || new Date().toISOString(),
        tracking_id_calendar: cal.id,
        name,
        enabled: (existing?.enabled as boolean) ?? false,
        provider: PROVIDER,
        source: cal.primary ? "primary" : undefined,
        color: cal.backgroundColor ?? "#888",
        connection_id: GOOGLE_CONNECTION_ID,
      };
      mainStore.setRow("calendars", rowId, row);
      trackingIdToRowId.set(cal.id, rowId);
      if (row.enabled) enabledRowIds.add(rowId);
    }

    // Prune calendars our cache had under provider=google that aren't there
    // anymore (e.g. user unshared / deleted on Google's side).
    for (const rowId of mainStore.getRowIds("calendars")) {
      const row = mainStore.getRow("calendars", rowId);
      if (row.provider !== PROVIDER) continue;
      const tracking = row.tracking_id_calendar as string | undefined;
      if (!tracking || seenCalendarTrackingIds.has(tracking)) continue;
      mainStore.delRow("calendars", rowId);
      // And its events.
      for (const eventId of mainStore.getRowIds("events")) {
        if (mainStore.getCell("events", eventId, "calendar_id") === rowId) {
          mainStore.delRow("events", eventId);
        }
      }
    }
  });

  // 3. Fetch events per enabled calendar, sliding window 7d back / 30d forward.
  const { fromIso, toIso } = isoWindow();
  let totalEvents = 0;
  const upstreamEventKey = new Set<string>(); // calendarRowId + ":" + tracking_id_event

  for (const [trackingId, calendarRowId] of trackingIdToRowId.entries()) {
    if (!enabledRowIds.has(calendarRowId)) continue;
    try {
      const url = new URL(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(trackingId)}/events`,
      );
      url.searchParams.set("timeMin", fromIso);
      url.searchParams.set("timeMax", toIso);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");
      url.searchParams.set("maxResults", "250");
      const res = await fetchAuthed(url.toString());
      if (!res.ok) {
        console.warn(
          `[google-sync] events fetch ${res.status} for calendar ${trackingId}: ${(await res.text()).slice(0, 200)}`,
        );
        continue;
      }
      const json = (await res.json()) as { items?: GoogleEvent[] };
      const events = (json.items ?? []).filter((e) => e.status !== "cancelled");

      mainStore.transaction(() => {
        for (const ev of events) {
          const started = ev.start?.dateTime ?? ev.start?.date ?? null;
          const ended = ev.end?.dateTime ?? ev.end?.date ?? null;
          if (!started || !ended) continue;

          upstreamEventKey.add(`${calendarRowId}:${ev.id}`);
          const existingRowId = findEventRowId(mainStore, calendarRowId, ev.id);
          const rowId = existingRowId ?? crypto.randomUUID();
          const existing = existingRowId
            ? mainStore.getRow("events", existingRowId)
            : null;

          const row: EventStorage = {
            user_id: userId,
            created_at:
              (existing?.created_at as string) || new Date().toISOString(),
            tracking_id_event: ev.id,
            calendar_id: calendarRowId,
            title: ev.summary ?? "(no title)",
            started_at: started,
            ended_at: ended,
            location: ev.location,
            meeting_link: ev.hangoutLink ?? meetingLinkFromConference(ev),
            description: ev.description,
            recurrence_series_id: ev.recurringEventId,
            has_recurrence_rules: !!ev.recurringEventId,
            is_all_day: !!ev.start?.date && !ev.start?.dateTime,
            provider: PROVIDER,
          };
          mainStore.setRow("events", rowId, row);
          totalEvents++;
        }
      });
    } catch (e) {
      console.warn(`[google-sync] events fetch threw for ${trackingId}`, e);
    }
  }

  // 4. Prune stale events: anything in our DB for an enabled google calendar
  // whose key didn't show up in the upstream response this cycle.
  mainStore.transaction(() => {
    for (const eventId of mainStore.getRowIds("events")) {
      const row = mainStore.getRow("events", eventId);
      if (row.provider !== PROVIDER) continue;
      const calendarRowId = row.calendar_id as string | undefined;
      if (!calendarRowId || !enabledRowIds.has(calendarRowId)) continue;
      const tracking = row.tracking_id_event as string | undefined;
      if (!tracking) continue;
      if (upstreamEventKey.has(`${calendarRowId}:${tracking}`)) continue;
      mainStore.delRow("events", eventId);
    }
  });

  return {
    ok: true,
    calendars: calendars.length,
    events: totalEvents,
  };
}

function persistTokens(settingsStore: AnyStore, t: StoredTokens) {
  settingsStore.setValue("google_access_token", t.accessToken);
  if (t.refreshToken)
    settingsStore.setValue("google_refresh_token", t.refreshToken);
  if (t.expiresAt)
    settingsStore.setValue("google_token_expires_at", t.expiresAt);
}

function isoWindow(): { fromIso: string; toIso: string } {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 7);
  const to = new Date(now);
  to.setDate(to.getDate() + 30);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

function meetingLinkFromConference(ev: GoogleEvent): string | undefined {
  const ep = ev.conferenceData?.entryPoints?.find(
    (p) => p.entryPointType === "video",
  );
  return ep?.uri;
}

function findCalendarRowId(store: AnyStore, trackingId: string): string | null {
  let found: string | null = null;
  store.forEachRow("calendars", (rowId: string, _forEachCell: unknown) => {
    if (found) return;
    const r = store.getRow("calendars", rowId);
    if (r.provider === PROVIDER && r.tracking_id_calendar === trackingId) {
      found = rowId;
    }
  });
  return found;
}

function findEventRowId(
  store: AnyStore,
  calendarRowId: string,
  trackingEventId: string,
): string | null {
  let found: string | null = null;
  store.forEachRow("events", (rowId: string, _forEachCell: unknown) => {
    if (found) return;
    const r = store.getRow("events", rowId);
    if (
      r.calendar_id === calendarRowId &&
      r.tracking_id_event === trackingEventId
    ) {
      found = rowId;
    }
  });
  return found;
}
