import { createDb } from "@meetspace/db";
import { createUseDrizzleLiveQuery, createUseLiveQuery } from "@meetspace/db-react";
import { tauriLiveQueryClient } from "@meetspace/db-tauri";

export const db = createDb(tauriLiveQueryClient);
export const useLiveQuery = createUseLiveQuery(tauriLiveQueryClient);
export const useDrizzleLiveQuery =
  createUseDrizzleLiveQuery(tauriLiveQueryClient);
