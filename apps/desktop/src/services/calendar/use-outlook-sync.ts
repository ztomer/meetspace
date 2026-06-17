import { useCallback, useEffect, useState } from "react";

import { syncOutlookCalendar } from "./outlook-sync";

import { useConfigValues } from "~/shared/config";
import * as main from "~/store/tinybase/store/main";
import * as settings from "~/store/tinybase/store/settings";

const SYNC_INTERVAL_MS = 5 * 60 * 1000;

export type OutlookSyncState = {
  isSyncing: boolean;
  lastSync: number | null;
  lastError: string | null;
  refresh: () => Promise<void>;
};

export function useOutlookCalendarSync(): OutlookSyncState {
  const mainStore = main.UI.useStore(main.STORE_ID);
  const settingsStore = settings.UI.useStore(settings.STORE_ID);
  const { user_id } = main.UI.useValues(main.STORE_ID);

  const { outlook_refresh_token } = useConfigValues([
    "outlook_refresh_token",
  ] as const);
  const signedIn = !!outlook_refresh_token;

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!mainStore || !settingsStore || !user_id) return;
    if (!signedIn) return;
    setIsSyncing(true);
    try {
      const result = await syncOutlookCalendar({
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
