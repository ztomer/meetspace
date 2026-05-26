import { Icon } from "@iconify-icon/react";
import { LmStudio, Ollama } from "@lobehub/icons";
import { ServerIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
  type ProviderRequirement,
  requiresConfigField,
} from "~/settings/ai/shared/eligibility";
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

// Local-first lineup. All providers speak the OpenAI-compatible HTTP API,
// so one client backs all of them. baseUrl is the only thing that varies
// for local servers; the "custom" provider is the escape hatch for cloud
// models (OpenRouter / direct provider URLs) without us shipping per-vendor UI.
const _PROVIDERS = [
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
  {
    id: "custom",
    displayName: "Custom (OpenAI-compatible)",
    badge: null,
    icon: <Icon icon="mingcute:random-fill" />,
    baseUrl: undefined,
    requirements: [{ kind: "requires_config", fields: ["base_url"] }],
  },
] as const satisfies readonly Provider[];

export const PROVIDERS = sortProviders(_PROVIDERS);
export type ProviderId = (typeof _PROVIDERS)[number]["id"];

export const llmProviderRequiresApiKey = (providerId: ProviderId) => {
  const provider = PROVIDERS.find((p) => p.id === providerId);
  return provider
    ? requiresConfigField(provider.requirements, "api_key")
    : false;
};
