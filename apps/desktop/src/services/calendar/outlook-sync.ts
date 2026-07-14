/**
 * Phase 10.2 — TS-side Outlook Calendar sync.
 *
 * Mirrors google-sync.ts against Microsoft Graph (`/me/calendars` +
 * `/me/calendarview`). Same shape: upserts the same `calendars` / `events`
 * rows. No Rust runtime; tokens read from SQLite settings,
 * refreshed on 401 via the existing `refresh()` helper.
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

export async function syncOutlookCalendar(): Promise<
  { ok: true; calendars: number; events: number } | { ok: false; error: string }
> {
  const storedSettings = await getStoredSettingValues();
  const clientId = (storedSettings.values.outlook_client_id as string | undefined)?.trim();
  const accessToken = storedSettings.values.outlook_access_token as string | undefined;
  const refreshTok = storedSettings.values.outlook_refresh_token as string | undefined;
  const expiresAt = storedSettings.values.outlook_token_expires_at as number | undefined;

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
        "outlook",
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

  // 1. Calendar list.
  let graphCalendars: GraphCalendar[];
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
    graphCalendars = json.value ?? [];
  } catch (e) {
    return {
      ok: false,
      error: `calendar list failed: ${(e as Error).message}`,
    };
  }

  const seenCalendarTrackingIds = new Set<string>();
  const trackingIdToRowId = new Map<string, string>();
  const enabledRowIds = new Set<string>();

  const existingCals = await db.select().from(calendars).where(eq(calendars.provider, PROVIDER));

  for (const cal of graphCalendars) {
    seenCalendarTrackingIds.add(cal.id);
    const existing = existingCals.find((c) => c.trackingIdCalendar === cal.id);
    const rowId = existing?.id ?? crypto.randomUUID();

    if (existing) {
      await db
        .update(calendars)
        .set({
          name: cal.name ?? cal.id,
          source: cal.isDefaultCalendar ? "primary" : "",
          color: cal.hexColor || "#888",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(calendars.id, rowId));
    } else {
      await db.insert(calendars).values({
        id: rowId,
        trackingIdCalendar: cal.id,
        name: cal.name ?? cal.id,
        enabled: false,
        provider: PROVIDER,
        source: cal.isDefaultCalendar ? "primary" : "",
        color: cal.hexColor || "#888",
        connectionId: OUTLOOK_CONNECTION_ID,
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
      const graphEvents = (json.value ?? []).filter((e) => !e.isCancelled);

      for (const ev of graphEvents) {
        const started = isoFromGraph(ev.start);
        const ended = isoFromGraph(ev.end);
        if (!started || !ended) continue;

        upstreamEventKey.add(`${calendarRowId}:${ev.id}`);
        const existing = existingEvents.find((e) => e.calendarId === calendarRowId && e.trackingIdEvent === ev.id);
        const rowId = existing?.id ?? crypto.randomUUID();

        const row = {
          trackingIdEvent: ev.id,
          calendarId: calendarRowId,
          title: ev.subject ?? "(no title)",
          startedAt: started,
          endedAt: ended,
          location: ev.location?.displayName ?? "",
          meetingLink: ev.onlineMeeting?.joinUrl ?? ev.onlineMeetingUrl ?? "",
          description: ev.bodyPreview ?? "",
          recurrenceSeriesId: ev.seriesMasterId ?? "",
          hasRecurrenceRules: !!ev.seriesMasterId,
          isAllDay: !!ev.isAllDay,
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
      console.warn(`[outlook-sync] events fetch threw for ${trackingId}`, e);
    }
  }

  // Prune stale events
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

  return { ok: true, calendars: graphCalendars.length, events: totalEvents };
}

async function persistTokens(t: StoredTokens) {
  const updates: Partial<SettingValues> = {
    outlook_access_token: t.accessToken,
  };
  if (t.refreshToken) {
    updates.outlook_refresh_token = t.refreshToken;
  }
  if (t.expiresAt) {
    updates.outlook_token_expires_at = t.expiresAt;
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

function isoFromGraph(g: GraphEvent["start"]): string | null {
  if (!g?.dateTime) return null;
  const dt = g.dateTime;
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(dt)) return dt;
  return `${dt}Z`;
}
