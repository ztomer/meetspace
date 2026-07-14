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

import { listOutlookCalendars } from "~/integrations/calendar-api";
import { OAUTH_PROVIDERS, signIn } from "~/integrations/oauth-providers";
import { useSetSettingValue } from "~/settings/queries";
import { useConfigValues } from "~/shared/config";

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

  const setClientId = useSetSettingValue("outlook_client_id");
  const setRefreshToken = useSetSettingValue("outlook_refresh_token");
  const setAccessToken = useSetSettingValue("outlook_access_token");
  const setExpiresAt = useSetSettingValue("outlook_token_expires_at");

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
    <section className="border-border rounded-lg border p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">{cfg.displayName} Calendar</h3>
          <p className="text-muted-foreground text-xs">
            Sign in with OAuth (PKCE). Your tokens never leave this device.
          </p>
        </div>
        {connected ? (
          <div className="text-success-fg flex items-center gap-1.5 text-xs">
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
          <p className="text-muted-foreground text-xs">
            Register a <strong>public client</strong> in{" "}
            <button
              type="button"
              onClick={() => void openerCommands.openUrl(cfg.consoleUrl, null)}
              className="hover:text-foreground inline-flex items-center gap-0.5 underline"
            >
              Microsoft Entra <ExternalLinkIcon size={11} />
            </button>{" "}
            with redirect URI{" "}
            <code className="bg-muted rounded px-1 text-[10px]">
              http://localhost
            </code>{" "}
            (mobile/desktop platform). Grant the{" "}
            <code className="bg-muted rounded px-1 text-[10px]">
              Calendars.Read
            </code>{" "}
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
          <p className="text-destructive text-xs">
            {(connect.error as Error).message}
          </p>
        ) : null}

        {connected ? (
          <div className="border-border mt-2 flex flex-col gap-1.5 border-t pt-3">
            <p className="text-muted-foreground text-xs font-medium">
              Your calendars
            </p>
            {calendarsQuery.isPending ? (
              <p className="text-muted-foreground text-xs">Loading…</p>
            ) : calendarsQuery.isError ? (
              <p className="text-destructive text-xs">
                {(calendarsQuery.error as Error).message}
              </p>
            ) : calendarsQuery.data && calendarsQuery.data.length > 0 ? (
              <ul className="flex flex-col gap-0.5 text-xs">
                {calendarsQuery.data.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <span className="bg-foreground/40 size-1.5 rounded-full" />
                    <span className="truncate">{c.name}</span>
                    {c.primary ? (
                      <span className="bg-muted rounded px-1 text-[10px]">
                        primary
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-xs">
                No calendars found.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
