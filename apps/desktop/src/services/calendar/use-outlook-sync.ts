/**
 * Periodic Outlook Calendar sync driver. Mount once at the app root. Polls
 * every 5 minutes while the user is signed into Outlook, fires immediately on
 * mount, and re-runs when tokens change.
 *
 * Returns `{ refresh, isSyncing, lastSync, error }` so the settings UI can
 * surface a manual refresh button and "Last synced …" status.
 */

import { useCallback, useEffect, useState } from "react";

import { syncOutlookCalendar } from "./outlook-sync";

import { useConfigValues } from "~/shared/config";

const SYNC_INTERVAL_MS = 5 * 60 * 1000;

export type OutlookSyncState = {
  isSyncing: boolean;
  lastSync: number | null;
  lastError: string | null;
  refresh: () => Promise<void>;
};

export function useOutlookCalendarSync(): OutlookSyncState {
  const { outlook_refresh_token } = useConfigValues([
    "outlook_refresh_token",
  ] as const);
  const signedIn = !!outlook_refresh_token;

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!signedIn) return;
    setIsSyncing(true);
    try {
      const result = await syncOutlookCalendar();
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
  }, [signedIn]);

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
