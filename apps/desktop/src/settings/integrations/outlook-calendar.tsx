import { useMutation } from "@tanstack/react-query";
import { CheckCircle2Icon, ExternalLinkIcon, LogInIcon, LogOutIcon } from "lucide-react";

import { commands as openerCommands } from "@meetspace/plugin-opener2";
import { Button } from "@meetspace/ui/components/ui/button";
import { Input } from "@meetspace/ui/components/ui/input";

import { OAUTH_PROVIDERS, signIn } from "~/integrations/oauth-providers";
import { useConfigValues } from "~/shared/config";
import * as settings from "~/store/tinybase/store/settings";

export function OutlookCalendarIntegration() {
  const cfg = OAUTH_PROVIDERS.outlook;
  const { outlook_client_id, outlook_refresh_token } = useConfigValues([
    "outlook_client_id",
    "outlook_refresh_token",
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
      </div>
    </section>
  );
}
