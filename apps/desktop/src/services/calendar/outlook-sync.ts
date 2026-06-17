/**
 * Phase 10.2 — TS-side Outlook Calendar sync.
 *
 * Mirrors google-sync.ts against Microsoft Graph (`/me/calendars` +
 * `/me/calendarview`). Same shape: upserts the same `calendars` / `events`
 * rows the existing sidebar agenda already reads. No Rust runtime; tokens
 * read from tinybase, refreshed on 401 via the existing `refresh()` helper.
 */

import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { Store } from "tinybase/with-schemas";

import type { CalendarStorage, EventStorage } from "@meetspace/store";

import {
  isExpired,
  refresh as refreshToken,
  type StoredTokens,
} from "~/integrations/oauth-providers";

// biome-ignore lint/suspicious/noExplicitAny: tinybase generic
type AnyStore = Store<any>;

const OUTLOOK_CONNECTION_ID = "outlook-default";
const PROVIDER = "outlook" as const;

type GraphCalendar = {
  id: string;
  name?: string;
  isDefaultCalendar?: boolean;
  color?: string;
  hexColor?: string;
};

type GraphEvent = {
  id: string;
  iCalUId?: string;
  subject?: string;
  bodyPreview?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  isAllDay?: boolean;
  isCancelled?: boolean;
  location?: { displayName?: string };
  onlineMeeting?: { joinUrl?: string };
  onlineMeetingUrl?: string;
  seriesMasterId?: string;
};

export async function syncOutlookCalendar(args: {
  mainStore: AnyStore;
  settingsStore: AnyStore;
  userId: string;
}): Promise<
  { ok: true; calendars: number; events: number } | { ok: false; error: string }
> {
  const { mainStore, settingsStore, userId } = args;

  const clientId = (
    settingsStore.getValue("outlook_client_id") as string | undefined
  )?.trim();
  const accessToken = settingsStore.getValue("outlook_access_token") as
    | string
    | undefined;
  const refreshTok = settingsStore.getValue("outlook_refresh_token") as
    | string
    | undefined;
  const expiresAt = settingsStore.getValue("outlook_token_expires_at") as
    | number
    | undefined;

  if (!clientId || !accessToken || !refreshTok) {
    return { ok: false, error: "outlook calendar not signed in" };
  }

  const tokenState: StoredTokens = {
    accessToken,
    refreshToken: refreshTok,
    expiresAt: expiresAt ?? null,
  };

  if (isExpired(tokenState.expiresAt) && tokenState.refreshToken) {
    try {
      const next = await refreshToken(
        "outlook",
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
        "outlook",
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

  // 1. Calendar list.
  let calendars: GraphCalendar[];
  try {
    const res = await fetchAuthed(
      "https://graph.microsoft.com/v1.0/me/calendars?$select=id,name,isDefaultCalendar,hexColor",
    );
    if (!res.ok) {
      return {
        ok: false,
        error: `calendar list ${res.status}: ${(await res.text()).slice(0, 200)}`,
      };
    }
    const json = (await res.json()) as { value?: GraphCalendar[] };
    calendars = json.value ?? [];
  } catch (e) {
    return {
      ok: false,
      error: `calendar list failed: ${(e as Error).message}`,
    };
  }

  const seenCalendarTrackingIds = new Set<string>();
  const trackingIdToRowId = new Map<string, string>();
  const enabledRowIds = new Set<string>();

  mainStore.transaction(() => {
    for (const cal of calendars) {
      seenCalendarTrackingIds.add(cal.id);
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
        name: cal.name ?? cal.id,
        enabled: (existing?.enabled as boolean) ?? false,
        provider: PROVIDER,
        source: cal.isDefaultCalendar ? "primary" : undefined,
        color: cal.hexColor || "#888",
        connection_id: OUTLOOK_CONNECTION_ID,
      };
      mainStore.setRow("calendars", rowId, row);
      trackingIdToRowId.set(cal.id, rowId);
      if (row.enabled) enabledRowIds.add(rowId);
    }

    // Prune upstream-gone calendars.
    for (const rowId of mainStore.getRowIds("calendars")) {
      const row = mainStore.getRow("calendars", rowId);
      if (row.provider !== PROVIDER) continue;
      const tracking = row.tracking_id_calendar as string | undefined;
      if (!tracking || seenCalendarTrackingIds.has(tracking)) continue;
      mainStore.delRow("calendars", rowId);
      for (const eventId of mainStore.getRowIds("events")) {
        if (mainStore.getCell("events", eventId, "calendar_id") === rowId) {
          mainStore.delRow("events", eventId);
        }
      }
    }
  });

  const { fromIso, toIso } = isoWindow();
  let totalEvents = 0;
  const upstreamEventKey = new Set<string>();

  for (const [trackingId, calendarRowId] of trackingIdToRowId.entries()) {
    if (!enabledRowIds.has(calendarRowId)) continue;
    try {
      // calendarview = expanded recurring instances, MS Graph's analog to
      // Google's singleEvents=true.
      const url = new URL(
        `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(trackingId)}/calendarview`,
      );
      url.searchParams.set("startDateTime", fromIso);
      url.searchParams.set("endDateTime", toIso);
      url.searchParams.set("$top", "250");
      url.searchParams.set(
        "$select",
        "id,iCalUId,subject,bodyPreview,start,end,isAllDay,isCancelled,location,onlineMeeting,onlineMeetingUrl,seriesMasterId",
      );
      const res = await fetchAuthed(url.toString());
      if (!res.ok) {
        console.warn(
          `[outlook-sync] events ${res.status} for ${trackingId}: ${(await res.text()).slice(0, 200)}`,
        );
        continue;
      }
      const json = (await res.json()) as { value?: GraphEvent[] };
      const events = (json.value ?? []).filter((e) => !e.isCancelled);

      mainStore.transaction(() => {
        for (const ev of events) {
          // MS Graph returns naive datetimes paired with a timeZone string.
          // Coerce to ISO Z by appending Z when missing — start.dateTime
          // already lacks an offset by API contract.
          const started = isoFromGraph(ev.start);
          const ended = isoFromGraph(ev.end);
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
            title: ev.subject ?? "(no title)",
            started_at: started,
            ended_at: ended,
            location: ev.location?.displayName,
            meeting_link: ev.onlineMeeting?.joinUrl ?? ev.onlineMeetingUrl,
            description: ev.bodyPreview,
            recurrence_series_id: ev.seriesMasterId,
            has_recurrence_rules: !!ev.seriesMasterId,
            is_all_day: !!ev.isAllDay,
            provider: PROVIDER,
          };
          mainStore.setRow("events", rowId, row);
          totalEvents++;
        }
      });
    } catch (e) {
      console.warn(`[outlook-sync] events fetch threw for ${trackingId}`, e);
    }
  }

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

  return { ok: true, calendars: calendars.length, events: totalEvents };
}

function persistTokens(settingsStore: AnyStore, t: StoredTokens) {
  settingsStore.setValue("outlook_access_token", t.accessToken);
  if (t.refreshToken)
    settingsStore.setValue("outlook_refresh_token", t.refreshToken);
  if (t.expiresAt)
    settingsStore.setValue("outlook_token_expires_at", t.expiresAt);
}

function isoWindow(): { fromIso: string; toIso: string } {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 7);
  const to = new Date(now);
  to.setDate(to.getDate() + 30);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

function isoFromGraph(g: GraphEvent["start"]): string | null {
  if (!g?.dateTime) return null;
  // Graph returns dateTime without a Z suffix; append one if missing so JS
  // Date parses it as UTC (matches what Graph stores internally when
  // timeZone="UTC", which we don't override).
  const dt = g.dateTime;
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(dt)) return dt;
  return `${dt}Z`;
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
