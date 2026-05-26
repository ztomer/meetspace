import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2Icon, ExternalLinkIcon, LogInIcon, LogOutIcon } from "lucide-react";

import { commands as openerCommands } from "@meetspace/plugin-opener2";
import { Button } from "@meetspace/ui/components/ui/button";
import { Input } from "@meetspace/ui/components/ui/input";

import { listOutlookCalendars } from "~/integrations/calendar-api";
import { OAUTH_PROVIDERS, signIn } from "~/integrations/oauth-providers";
import { useConfigValues } from "~/shared/config";
import * as settings from "~/store/tinybase/store/settings";

export function OutlookCalendarIntegration() {
  const cfg = OAUTH_PROVIDERS.outlook;
  const {
    outlook_client_id,
    outlook_refresh_token,
    outlook_access_token,
    outlook_token_expires_at,
  } = useConfigValues([
    "outlook_client_id",
    "outlook_refresh_token",
    "outlook_access_token",
    "outlook_token_expires_at",
  ] as const);

  const setClientId = settings.UI.useSetValueCallback(
    "outlook_client_id",
    (v: string) => v,
    [],
    settings.STORE_ID,
  );
  const setRefreshToken = settings.UI.useSetValueCallback(
    "outlook_refresh_token",
    (v: string) => v,
    [],
    settings.STORE_ID,
  );
  const setAccessToken = settings.UI.useSetValueCallback(
    "outlook_access_token",
    (v: string) => v,
    [],
    settings.STORE_ID,
  );
  const setExpiresAt = settings.UI.useSetValueCallback(
    "outlook_token_expires_at",
    (v: number) => v,
    [],
    settings.STORE_ID,
  );

  const connected = !!outlook_refresh_token;
  const clientId = (outlook_client_id ?? "").trim();

  const connect = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Add a Microsoft OAuth client id first");
      return signIn("outlook", clientId);
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
    queryKey: ["outlook-calendars", outlook_refresh_token],
    enabled: connected && !!outlook_access_token,
    queryFn: () =>
      listOutlookCalendars({
        clientId,
        accessToken: outlook_access_token!,
        refreshTokenValue: outlook_refresh_token ?? null,
        expiresAt: outlook_token_expires_at ?? null,
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
          <div className="flex items-center gap-1.5 text-xs text-green-700">
            <CheckCircle2Icon size={14} />
            Connected
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="outlook-client-id" className="text-sm font-medium">
            Application (client) ID
          </label>
          <Input
            id="outlook-client-id"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
            className="shadow-none"
          />
          <p className="text-xs text-muted-foreground">
            Register a <strong>public client</strong> in{" "}
            <button
              type="button"
              onClick={() =>
                void openerCommands.openUrl(cfg.consoleUrl, null)
              }
              className="inline-flex items-center gap-0.5 underline hover:text-foreground"
            >
              Microsoft Entra <ExternalLinkIcon size={11} />
            </button>{" "}
            with redirect URI <code className="rounded bg-muted px-1 text-[10px]">http://localhost</code>{" "}
            (mobile/desktop platform). Grant the{" "}
            <code className="rounded bg-muted px-1 text-[10px]">Calendars.Read</code>{" "}
            delegated permission. No client secret needed.
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
              <p className="text-xs text-muted-foreground">No calendars found.</p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
