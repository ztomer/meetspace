import type { ConnectionItem } from "@meetspace/api-client";

export function useConnections(_enabled?: boolean) {
  return {
    data: [] as ConnectionItem[],
    isError: false,
    isPending: false,
  };
}
