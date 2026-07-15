import type {
  DrizzleProxyClient,
  LiveQueryClient,
  TransactionClient,
} from "@meetspace/db-runtime";
import {
  execute,
  executeProxy,
  executeTransaction,
  subscribe,
} from "@meetspace/plugin-db";

export const tauriLiveQueryClient: LiveQueryClient & DrizzleProxyClient = {
  execute,
  executeProxy,
  subscribe,
};

export const tauriTransactionClient: TransactionClient = {
  executeTransaction,
};
