import { LaptopIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { LocalModel } from "@meetspace/plugin-local-stt";

import { type ProviderRequirement } from "~/settings/ai/shared/eligibility";
import {
  keepLocalProviders,
  LOCAL_STT_PROVIDER_IDS,
} from "~/settings/ai/shared/local-providers";
import { sortProviders } from "~/settings/ai/shared/sort-providers";
import { localSttQueries } from "~/stt/useLocalSttModel";

export { localSttQueries as sttModelQueries };

type Provider = {
  disabled: boolean;
  id: string;
  displayName: string;
  icon: ReactNode;
  baseUrl?: string;
  models: LocalModel[] | string[];
  badge?: string | null;
  requirements: ProviderRequirement[];
};

export const displayModelId = (model: string) => {
  if (model === "parakeet-tdt-0.6b-v3") {
    return "Parakeet TDT 0.6B V3";
  }

  if (model === "faster-whisper-large-v3-turbo") {
    return "Faster Whisper Large V3 Turbo";
  }

  return model;
};

export function formatModelSize(sizeBytes?: number | null) {
  if (!sizeBytes) {
    return null;
  }

  const unit = sizeBytes >= 1024 * 1024 * 1024 ? "GB" : "MB";
  const value =
    unit === "GB" ? sizeBytes / 1024 / 1024 / 1024 : sizeBytes / 1024 / 1024;

  return `~${value.toLocaleString(undefined, {
    maximumFractionDigits: value >= 10 ? 0 : 1,
  })} ${unit}`;
}

// Upstream's STT providers (all hosted/cloud). AT SYNC: replace this array
// wholesale with upstream's list — do NOT trim it; the allowlist hides them.
const _UPSTREAM_PROVIDERS = [] as const satisfies readonly Provider[];

// Fork-added local provider. The picker is local-only: we keep a single
// internal "meetspace" provider because tinybase settings and several callers
// persist a provider id, but the UI surfaces only the model list. This is part
// of the fork delta and must survive a sync.
const _FORK_PROVIDERS = [
  {
    disabled: false,
    id: "meetspace",
    displayName: "Local",
    badge: null,
    icon: <LaptopIcon className="size-4" />,
    baseUrl: undefined,
    models: [],
    requirements: [],
  },
] as const satisfies readonly Provider[];

const _PROVIDERS = [..._UPSTREAM_PROVIDERS, ..._FORK_PROVIDERS];

// Hide cloud providers: only the local-provider allowlist reaches the UI.
export const PROVIDERS = sortProviders(
  keepLocalProviders(_PROVIDERS, LOCAL_STT_PROVIDER_IDS),
);
export type ProviderId =
  | (typeof _UPSTREAM_PROVIDERS)[number]["id"]
  | (typeof _FORK_PROVIDERS)[number]["id"];

/** Internal id of the local provider — used to seed settings on first run. */
export const LOCAL_STT_PROVIDER_ID: ProviderId = "meetspace";
