import type { ConnectionItem } from "@hypr/api-client";

export function useConnections(_enabled?: boolean) {
  return {
    data: [] as ConnectionItem[],
    isError: false,
    isPending: false,
  };
}
