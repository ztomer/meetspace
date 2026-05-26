import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  LogInIcon,
  LogOutIcon,
} from "lucide-react";

import { commands as openerCommands } from "@meetspace/plugin-opener2";
import { Button } from "@meetspace/ui/components/ui/button";
import { Input } from "@meetspace/ui/components/ui/input";

import { listGoogleCalendars } from "~/integrations/calendar-api";
import { OAUTH_PROVIDERS, signIn } from "~/integrations/oauth-providers";
import { useConfigValues } from "~/shared/config";
import * as settings from "~/store/tinybase/store/settings";

export function GoogleCalendarIntegration() {
  const cfg = OAUTH_PROVIDERS.google;
  const {
    google_client_id,
    google_refresh_token,
    google_access_token,
    google_token_expires_at,
  } = useConfigValues([
    "google_client_id",
    "google_refresh_token",
    "google_access_token",
    "google_token_expires_at",
  ] as const);

  const setClientId = settings.UI.useSetValueCallback(
    "google_client_id",
    (v: string) => v,
    [],
    settings.STORE_ID,
  );
  const setRefreshToken = settings.UI.useSetValueCallback(
    "google_refresh_token",
    (v: string) => v,
    [],
    settings.STORE_ID,
  );
  const setAccessToken = settings.UI.useSetValueCallback(
    "google_access_token",
    (v: string) => v,
    [],
    settings.STORE_ID,
  );
  const setExpiresAt = settings.UI.useSetValueCallback(
    "google_token_expires_at",
    (v: number) => v,
    [],
    settings.STORE_ID,
  );

  const connected = !!google_refresh_token;
  const clientId = (google_client_id ?? "").trim();

  const connect = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Add a Google OAuth client id first");
      return signIn("google", clientId);
    },
    onSuccess: (tokens) => {
      setAccessToken(tokens.accessToken);
      if (tokens.refreshToken) setRefreshToken(tokens.refreshToken);
      if (tokens.expiresAt) setExpiresAt(tokens.expiresAt);
    },
  });

  const disconnect = () => {
    setRefreshToken("");
    setAccessToken("");
    setExpiresAt(0);
  };

  const calendarsQuery = useQuery({
    queryKey: ["google-calendars", google_refresh_token],
    enabled: connected && !!google_access_token,
    queryFn: () =>
      listGoogleCalendars({
        clientId,
        accessToken: google_access_token!,
        refreshTokenValue: google_refresh_token ?? null,
        expiresAt: google_token_expires_at ?? null,
        onTokenRefresh: (next) => {
          setAccessToken(next.accessToken);
          if (next.refreshToken) setRefreshToken(next.refreshToken);
          if (next.expiresAt) setExpiresAt(next.expiresAt);
        },
      }),
  });

  return (
    <section className="rounded-lg border border-border p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">{cfg.displayName} Calendar</h3>
          <p className="text-xs text-muted-foreground">
            Sign in with OAuth (PKCE). Your tokens never leave this device.
          </p>
        </div>
        {connected ? (
          <div className="flex items-center gap-1.5 text-xs text-success-fg">
            <CheckCircle2Icon size={14} />
            Connected
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="google-client-id" className="text-sm font-medium">
            OAuth client ID
          </label>
          <Input
            id="google-client-id"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="123456789-abc.apps.googleusercontent.com"
            className="shadow-none"
          />
          <p className="text-xs text-muted-foreground">
            Create a <strong>Desktop app</strong> OAuth client at{" "}
            <button
              type="button"
              onClick={() =>
                void openerCommands.openUrl(cfg.consoleUrl, null)
              }
              className="inline-flex items-center gap-0.5 underline hover:text-foreground"
            >
              Google Cloud Console <ExternalLinkIcon size={11} />
            </button>
            . Enable the Google Calendar API for your project. The redirect URI
            is filled in automatically by the OAuth flow.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {connected ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => connect.mutate()}
                disabled={connect.isPending}
              >
                <LogInIcon size={14} />
                Re-authorize
              </Button>
              <Button variant="outline" size="sm" onClick={disconnect}>
                <LogOutIcon size={14} />
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => connect.mutate()}
              disabled={!clientId || connect.isPending}
            >
              <LogInIcon size={14} />
              {connect.isPending ? "Waiting for browser…" : "Sign in"}
            </Button>
          )}
        </div>

        {connect.error ? (
          <p className="text-xs text-destructive">
            {(connect.error as Error).message}
          </p>
        ) : null}

        {connected ? (
          <div className="mt-2 flex flex-col gap-1.5 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground">
              Your calendars
            </p>
            {calendarsQuery.isPending ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : calendarsQuery.isError ? (
              <p className="text-xs text-destructive">
                {(calendarsQuery.error as Error).message}
              </p>
            ) : calendarsQuery.data && calendarsQuery.data.length > 0 ? (
              <ul className="flex flex-col gap-0.5 text-xs">
                {calendarsQuery.data.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-foreground/40" />
                    <span className="truncate">{c.name}</span>
                    {c.primary ? (
                      <span className="rounded bg-muted px-1 text-[10px]">
                        primary
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                No calendars found.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
