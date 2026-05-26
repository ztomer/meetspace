import { useMCP } from "./useMCP";

export function useResearchMCP(enabled: boolean, accessToken?: string | null) {
  return useMCP({
    enabled,
    endpoint: "/research/mcp",
    clientName: "meetspace-research-client",
    accessToken,
    promptName: "research_chat",
  });
}
