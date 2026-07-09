import type { LiveQueryClient } from "@meetspace/db-runtime";
import type { DrizzleProxyClient } from "@meetspace/db-runtime";
import { execute, executeProxy, subscribe } from "@meetspace/plugin-db";

export const tauriLiveQueryClient: LiveQueryClient & DrizzleProxyClient = {
  execute,
  executeProxy,
  subscribe,
};
