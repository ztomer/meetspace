import { Icon } from "@iconify-icon/react";
import { LmStudio, Ollama } from "@lobehub/icons";
import { ServerIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
  type ProviderRequirement,
  requiresConfigField,
} from "~/settings/ai/shared/eligibility";
import {
  keepLocalProviders,
  LOCAL_LLM_PROVIDER_IDS,
} from "~/settings/ai/shared/local-providers";
import { sortProviders } from "~/settings/ai/shared/sort-providers";

type Provider = {
  id: string;
  displayName: string;
  badge: string | null;
  icon: ReactNode;
  baseUrl?: string;
  requirements: ProviderRequirement[];
  links?: {
    download?: { label: string; url: string };
    models?: { label: string; url: string };
    setup?: { label: string; url: string };
  };
};

// Upstream's provider lineup (local + cloud). AT SYNC: replace this array
// wholesale with upstream's `_PROVIDERS` — do NOT trim it. Cloud entries are
// hidden by the local allowlist below, not deleted, which keeps the merge clean
// and the provider type wide enough for upstream's enhance/provider code.
const _UPSTREAM_PROVIDERS = [
  {
    id: "ollama",
    displayName: "Ollama",
    badge: null,
    icon: <Ollama size={16} />,
    baseUrl: "http://127.0.0.1:11434/v1",
    requirements: [],
    links: {
      download: {
        label: "Download Ollama",
        url: "https://ollama.com/download",
      },
      models: { label: "Available models", url: "https://ollama.com/library" },
    },
  },
  {
    id: "lmstudio",
    displayName: "LM Studio",
    badge: null,
    icon: <LmStudio size={16} />,
    baseUrl: "http://127.0.0.1:1234/v1",
    requirements: [],
    links: {
      download: {
        label: "Download LM Studio",
        url: "https://lmstudio.ai/download",
      },
      models: { label: "Available models", url: "https://lmstudio.ai/models" },
    },
  },
] as const satisfies readonly Provider[];

// Providers this fork ADDS on top of upstream (upstream has neither). These are
// part of the fork delta and must survive a sync — re-add them after taking
// upstream's list. Both speak the OpenAI-compatible HTTP API; "custom" is the
// BYO escape hatch (user's own endpoint), not a hosted/branded cloud provider.
const _FORK_PROVIDERS = [
  {
    id: "osaurus",
    displayName: "Osaurus",
    badge: "Recommended",
    icon: <ServerIcon className="size-4" />,
    baseUrl: "http://127.0.0.1:1337/v1",
    requirements: [],
    links: {
      download: {
        label: "Osaurus on GitHub",
        url: "https://github.com/dinoki-ai/osaurus",
      },
    },
  },
  {
    id: "custom",
    displayName: "Custom (OpenAI-compatible)",
    badge: null,
    icon: <Icon icon="mingcute:random-fill" />,
    baseUrl: undefined,
    requirements: [{ kind: "requires_config", fields: ["base_url"] }],
  },
] as const satisfies readonly Provider[];

const _PROVIDERS = [..._UPSTREAM_PROVIDERS, ..._FORK_PROVIDERS];

// Hide cloud providers: only the local-provider allowlist reaches the UI.
export const PROVIDERS = sortProviders(
  keepLocalProviders(_PROVIDERS, LOCAL_LLM_PROVIDER_IDS),
);
export type ProviderId =
  | (typeof _UPSTREAM_PROVIDERS)[number]["id"]
  | (typeof _FORK_PROVIDERS)[number]["id"];

export const llmProviderRequiresApiKey = (providerId: ProviderId) => {
  const provider = PROVIDERS.find((p) => p.id === providerId);
  return provider
    ? requiresConfigField(provider.requirements, "api_key")
    : false;
};
