/**
 * Periodic Google Calendar sync driver. Mount once at the app root. Polls
 * every 5 minutes while the user is signed into Google, fires immediately on
 * mount, and re-runs when tokens / enabled-calendars change.
 *
 * Returns `{ refresh, isSyncing, lastSync, error }` so the settings UI can
 * surface a manual refresh button and "Last synced …" status.
 */

import { useCallback, useEffect, useState } from "react";

import { syncGoogleCalendar } from "./google-sync";

import { useConfigValues } from "~/shared/config";
import * as main from "~/store/tinybase/store/main";
import * as settings from "~/store/tinybase/store/settings";

const SYNC_INTERVAL_MS = 5 * 60 * 1000;

export type GoogleSyncState = {
  isSyncing: boolean;
  lastSync: number | null;
  lastError: string | null;
  refresh: () => Promise<void>;
};

export function useGoogleCalendarSync(): GoogleSyncState {
  const mainStore = main.UI.useStore(main.STORE_ID);
  const settingsStore = settings.UI.useStore(settings.STORE_ID);
  const { user_id } = main.UI.useValues(main.STORE_ID);

  // Re-trigger when sign-in state flips by depending on the refresh_token
  // presence. Don't depend on access_token directly — that rotates often.
  const { google_refresh_token } = useConfigValues([
    "google_refresh_token",
  ] as const);
  const signedIn = !!google_refresh_token;

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!mainStore || !settingsStore || !user_id) return;
    if (!signedIn) return;
    setIsSyncing(true);
    try {
      const result = await syncGoogleCalendar({
        mainStore,
        settingsStore,
        userId: user_id,
      });
      if (result.ok) {
        setLastSync(Date.now());
        setLastError(null);
      } else {
        setLastError(result.error);
      }
    } catch (e) {
      setLastError((e as Error).message);
    } finally {
      setIsSyncing(false);
    }
  }, [mainStore, settingsStore, user_id, signedIn]);

  // Fire on mount + when sign-in flips, then on a 5-min ticker.
  useEffect(() => {
    if (!signedIn) return;
    void refresh();
    const handle = setInterval(() => {
      void refresh();
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(handle);
  }, [refresh, signedIn]);

  return { isSyncing, lastSync, lastError, refresh };
}
