/**
 * OAuth provider configs for the calendar integrations. Each entry is
 * everything the @meetspace/plugin-oauth Rust side needs to drive a PKCE
 * flow (authorize URL, token URL, scopes, provider-specific extra params),
 * plus a `refresh` function to swap a refresh_token for a fresh access_token
 * when the cached one expires.
 *
 * The user supplies their own `client_id` once via Settings → Integrations.
 * No client secret is needed (PKCE).
 */

import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

import {
  commands as oauthCommands,
  type PkceTokens,
} from "@meetspace/plugin-oauth";

export type OAuthProviderId = "google" | "outlook";

export type OAuthProviderConfig = {
  id: OAuthProviderId;
  displayName: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string;
  extraAuthorizeParams: Record<string, string>;
  /** Where users go to register a desktop OAuth client of their own. */
  consoleUrl: string;
};

export const OAUTH_PROVIDERS: Record<OAuthProviderId, OAuthProviderConfig> = {
  google: {
    id: "google",
    displayName: "Google",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes:
      "https://www.googleapis.com/auth/calendar.readonly openid email profile",
    extraAuthorizeParams: {
      // Google only mints a refresh_token if these are both present.
      access_type: "offline",
      prompt: "consent",
    },
    consoleUrl: "https://console.cloud.google.com/apis/credentials",
  },
  outlook: {
    id: "outlook",
    displayName: "Outlook",
    authorizeUrl:
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: "Calendars.Read offline_access openid email profile",
    extraAuthorizeParams: {},
    consoleUrl: "https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
  },
};

export type StoredTokens = {
  accessToken: string;
  refreshToken: string | null;
  /** Epoch milliseconds. `null` means "unknown — treat as expired". */
  expiresAt: number | null;
};

/** Sign in via PKCE. Returns tokens for the caller to persist. */
export async function signIn(
  provider: OAuthProviderId,
  clientId: string,
): Promise<StoredTokens> {
  const cfg = OAUTH_PROVIDERS[provider];
  const result = await oauthCommands.startPkceFlow({
    provider: cfg.id,
    clientId,
    scopes: cfg.scopes,
    authorizeUrl: cfg.authorizeUrl,
    tokenUrl: cfg.tokenUrl,
    extraAuthorizeParams: cfg.extraAuthorizeParams,
  });
  if (result.status === "error") {
    throw new Error(result.error);
  }
  return toStored(result.data);
}

/**
 * Exchange a refresh_token for a fresh access_token. Done client-side here
 * (no Rust plugin needed — it's a simple form POST and the refresh_token
 * already lives in TS land).
 */
export async function refresh(
  provider: OAuthProviderId,
  clientId: string,
  refreshToken: string,
): Promise<StoredTokens> {
  const cfg = OAUTH_PROVIDERS[provider];
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    refresh_token: refreshToken,
  });
  const res = await tauriFetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${cfg.displayName} refresh failed: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as PkceTokens & {
    error?: string;
    error_description?: string;
  };
  if (json.error) {
    throw new Error(`${json.error}: ${json.error_description ?? ""}`);
  }
  return toStored({
    accessToken: json.accessToken ?? (json as any).access_token,
    // Refresh responses don't always re-issue a refresh_token; keep the old one
    // if absent.
    refreshToken:
      json.refreshToken ?? (json as any).refresh_token ?? refreshToken,
    expiresIn: json.expiresIn ?? (json as any).expires_in ?? null,
    tokenType: null,
    scope: null,
  });
}

function toStored(t: PkceTokens): StoredTokens {
  return {
    accessToken: t.accessToken,
    refreshToken: t.refreshToken,
    expiresAt:
      typeof t.expiresIn === "number" && t.expiresIn > 0
        ? Date.now() + (t.expiresIn - 60) * 1000 // refresh a minute before expiry
        : null,
  };
}

export function isExpired(expiresAt: number | null | undefined): boolean {
  if (typeof expiresAt !== "number") return true;
  return Date.now() >= expiresAt;
}
