import { createDb } from "@meetspace/db";
import { createUseDrizzleLiveQuery, createUseLiveQuery } from "@meetspace/db-react";
import { tauriLiveQueryClient, tauriTransactionClient } from "@meetspace/db-tauri";

export const liveQueryClient = tauriLiveQueryClient;
export const db = createDb(liveQueryClient);
export const useLiveQuery = createUseLiveQuery(liveQueryClient);
export const useDrizzleLiveQuery = createUseDrizzleLiveQuery(liveQueryClient);
export const executeTransaction = tauriTransactionClient.executeTransaction;
