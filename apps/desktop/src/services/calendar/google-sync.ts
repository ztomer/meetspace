/**
 * Phase 10.1 — TS-side Google Calendar sync.
 *
 * Bypasses the Rust runtime entirely for Google. Reads tokens from SQLite settings,
 * calls the Google Calendar v3 REST API via @tauri-apps/plugin-http,
 * upserts rows into the local `calendars` and `events` tables.
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
import { eq, and, inArray } from "drizzle-orm";
import { db } from "~/db";
import { calendars, events } from "@meetspace/db";
import { getStoredSettingValues, setSettingValues } from "~/settings/queries";
import type { SettingValues } from "~/settings/schema";

import {
  isExpired,
  refresh as refreshToken,
  type StoredTokens,
} from "~/integrations/oauth-providers";

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
export async function syncGoogleCalendar(): Promise<
  { ok: true; calendars: number; events: number } | { ok: false; error: string }
> {
  const storedSettings = await getStoredSettingValues();
  const clientId = (storedSettings.values.google_client_id as string | undefined)?.trim();
  const accessToken = storedSettings.values.google_access_token as string | undefined;
  const refreshTok = storedSettings.values.google_refresh_token as string | undefined;
  const expiresAt = storedSettings.values.google_token_expires_at as number | undefined;

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
      await persistTokens(next);
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
      await persistTokens(next);
      tokenState.accessToken = next.accessToken;
      tokenState.refreshToken = next.refreshToken ?? tokenState.refreshToken;
      tokenState.expiresAt = next.expiresAt;
      res = await doFetch(next.accessToken);
    }
    return res;
  };

  // 1. Fetch calendar list.
  let googleCalendars: GoogleCalendar[];
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
    googleCalendars = json.items ?? [];
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

  const existingCals = await db.select().from(calendars).where(eq(calendars.provider, PROVIDER));

  for (const cal of googleCalendars) {
    seenCalendarTrackingIds.add(cal.id);
    const name = cal.summaryOverride ?? cal.summary ?? cal.id;
    const existing = existingCals.find((c) => c.trackingIdCalendar === cal.id);
    const rowId = existing?.id ?? crypto.randomUUID();

    if (existing) {
      await db
        .update(calendars)
        .set({
          name,
          source: cal.primary ? "primary" : "",
          color: cal.backgroundColor ?? "#888",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(calendars.id, rowId));
    } else {
      await db.insert(calendars).values({
        id: rowId,
        trackingIdCalendar: cal.id,
        name,
        enabled: false,
        provider: PROVIDER,
        source: cal.primary ? "primary" : "",
        color: cal.backgroundColor ?? "#888",
        connectionId: GOOGLE_CONNECTION_ID,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    trackingIdToRowId.set(cal.id, rowId);
    if (existing?.enabled ?? false) {
      enabledRowIds.add(rowId);
    }
  }

  const calendarsToDelete = existingCals.filter((c) => !seenCalendarTrackingIds.has(c.trackingIdCalendar));
  for (const cal of calendarsToDelete) {
    await db.delete(events).where(eq(events.calendarId, cal.id));
    await db.delete(calendars).where(eq(calendars.id, cal.id));
  }

  // 3. Fetch events per enabled calendar, sliding window 7d back / 30d forward.
  const { fromIso, toIso } = isoWindow();
  let totalEvents = 0;
  const upstreamEventKey = new Set<string>();

  const enabledCalendarIdsArray = Array.from(enabledRowIds);
  const existingEvents = enabledCalendarIdsArray.length > 0
    ? await db.select().from(events).where(inArray(events.calendarId, enabledCalendarIdsArray))
    : [];

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
      const googleEvents = (json.items ?? []).filter((e) => e.status !== "cancelled");

      for (const ev of googleEvents) {
        const started = ev.start?.dateTime ?? ev.start?.date ?? null;
        const ended = ev.end?.dateTime ?? ev.end?.date ?? null;
        if (!started || !ended) continue;

        upstreamEventKey.add(`${calendarRowId}:${ev.id}`);
        const existing = existingEvents.find((e) => e.calendarId === calendarRowId && e.trackingIdEvent === ev.id);
        const rowId = existing?.id ?? crypto.randomUUID();

        const row = {
          trackingIdEvent: ev.id,
          calendarId: calendarRowId,
          title: ev.summary ?? "(no title)",
          startedAt: started,
          endedAt: ended,
          location: ev.location ?? "",
          meetingLink: ev.hangoutLink ?? meetingLinkFromConference(ev) ?? "",
          description: ev.description ?? "",
          recurrenceSeriesId: ev.recurringEventId ?? "",
          hasRecurrenceRules: !!ev.recurringEventId,
          isAllDay: !!ev.start?.date && !ev.start?.dateTime,
          provider: PROVIDER,
          updatedAt: new Date().toISOString(),
        };

        if (existing) {
          await db
            .update(events)
            .set(row)
            .where(eq(events.id, rowId));
        } else {
          await db.insert(events).values({
            id: rowId,
            ...row,
            createdAt: new Date().toISOString(),
          });
        }
        totalEvents++;
      }
    } catch (e) {
      console.warn(`[google-sync] events fetch threw for ${trackingId}`, e);
    }
  }

  // 4. Prune stale events
  if (enabledCalendarIdsArray.length > 0) {
    const allEventsForEnabled = await db
      .select()
      .from(events)
      .where(and(eq(events.provider, PROVIDER), inArray(events.calendarId, enabledCalendarIdsArray)));

    for (const ev of allEventsForEnabled) {
      if (!upstreamEventKey.has(`${ev.calendarId}:${ev.trackingIdEvent}`)) {
        await db.delete(events).where(eq(events.id, ev.id));
      }
    }
  }

  return {
    ok: true,
    calendars: googleCalendars.length,
    events: totalEvents,
  };
}

async function persistTokens(t: StoredTokens) {
  const updates: Partial<SettingValues> = {
    google_access_token: t.accessToken,
  };
  if (t.refreshToken) {
    updates.google_refresh_token = t.refreshToken;
  }
  if (t.expiresAt) {
    updates.google_token_expires_at = t.expiresAt;
  }
  await setSettingValues(updates as SettingValues);
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
