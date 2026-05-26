/**
 * Thin wrappers around Google Calendar API + Microsoft Graph that use the
 * locally-stored OAuth tokens. Auto-refresh on 401 using the refresh_token,
 * persist new tokens back to tinybase via the provided `onTokenRefresh`
 * callback.
 *
 * These return shaped data (a list of calendars) for the smoke-test surface
 * in Settings → Integrations. Deeper integration (sidebar agenda, event
 * sync, the `calendars` tinybase table) is a follow-up that will likely
 * route through a Rust runtime — see Phase 8.4b/8.5b open items in
 * `docs/FORK_PLAN.md`.
 */

import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

import {
  isExpired,
  OAUTH_PROVIDERS,
  type OAuthProviderId,
  refresh as refreshToken,
  type StoredTokens,
} from "./oauth-providers";

export type CalendarListEntry = {
  id: string;
  name: string;
  primary?: boolean;
};

export type TokenRefreshCallback = (next: StoredTokens) => void;

type FetchInput = {
  provider: OAuthProviderId;
  clientId: string;
  accessToken: string;
  refreshTokenValue: string | null;
  expiresAt: number | null;
  onTokenRefresh: TokenRefreshCallback;
};

/**
 * Issue an authenticated request; transparently refresh on expiry or 401.
 * The caller persists any new tokens via `onTokenRefresh`.
 */
async function authedFetch(
  input: FetchInput,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  let access = input.accessToken;

  // Pre-emptive refresh if we know the cached token is expired.
  if (input.refreshTokenValue && isExpired(input.expiresAt)) {
    const next = await refreshToken(
      input.provider,
      input.clientId,
      input.refreshTokenValue,
    );
    input.onTokenRefresh(next);
    access = next.accessToken;
  }

  const doFetch = (token: string) =>
    tauriFetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });

  let res = await doFetch(access);

  // Reactive refresh on 401 (token revoked or our expiry estimate was wrong).
  if (res.status === 401 && input.refreshTokenValue) {
    const next = await refreshToken(
      input.provider,
      input.clientId,
      input.refreshTokenValue,
    );
    input.onTokenRefresh(next);
    res = await doFetch(next.accessToken);
  }

  return res;
}

/** Google: `GET /calendar/v3/users/me/calendarList`. */
export async function listGoogleCalendars(
  input: Omit<FetchInput, "provider">,
): Promise<CalendarListEntry[]> {
  const res = await authedFetch(
    { ...input, provider: "google" },
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?fields=items(id,summary,primary)",
  );
  if (!res.ok) {
    throw new Error(
      `${OAUTH_PROVIDERS.google.displayName} API ${res.status}: ${await res.text()}`,
    );
  }
  const json = (await res.json()) as {
    items?: Array<{ id: string; summary?: string; primary?: boolean }>;
  };
  return (json.items ?? []).map((c) => ({
    id: c.id,
    name: c.summary ?? c.id,
    primary: c.primary,
  }));
}

/** Microsoft Graph: `GET /me/calendars`. */
export async function listOutlookCalendars(
  input: Omit<FetchInput, "provider">,
): Promise<CalendarListEntry[]> {
  const res = await authedFetch(
    { ...input, provider: "outlook" },
    "https://graph.microsoft.com/v1.0/me/calendars?$select=id,name,isDefaultCalendar",
  );
  if (!res.ok) {
    throw new Error(
      `${OAUTH_PROVIDERS.outlook.displayName} API ${res.status}: ${await res.text()}`,
    );
  }
  const json = (await res.json()) as {
    value?: Array<{ id: string; name?: string; isDefaultCalendar?: boolean }>;
  };
  return (json.value ?? []).map((c) => ({
    id: c.id,
    name: c.name ?? c.id,
    primary: c.isDefaultCalendar,
  }));
}
