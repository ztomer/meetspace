import { LaptopIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { LocalModel } from "@meetspace/plugin-local-stt";

import {
  type ProviderRequirement,
} from "~/settings/ai/shared/eligibility";
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

// The picker is local-only. We keep a single internal provider ("meetspace")
// because tinybase settings and several callers persist a provider id, but
// the UI surfaces only the model list — no provider selector.
const _PROVIDERS = [
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

export const PROVIDERS = sortProviders(_PROVIDERS);
export type ProviderId = (typeof _PROVIDERS)[number]["id"];

/** Internal id of the local provider — used to seed settings on first run. */
export const LOCAL_STT_PROVIDER_ID: ProviderId = "meetspace";
