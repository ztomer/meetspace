import type { ConnectionItem } from "~/shared/api-types";

export function useConnections(_enabled?: boolean) {
  return {
    data: [] as ConnectionItem[],
    isError: false,
    isPending: false,
  };
}
