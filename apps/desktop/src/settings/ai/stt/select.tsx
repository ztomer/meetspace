import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { arch } from "@tauri-apps/plugin-os";
import {
  AlertTriangle,
  Check,
  FolderOpen,
  Loader2,
  Trash2,
} from "lucide-react";
import { useEffect } from "react";

import {
  commands as localSttCommands,
  type LocalModel,
} from "@meetspace/plugin-local-stt";
import { commands as openerCommands } from "@meetspace/plugin-opener2";
import { commands as listenerCommands } from "@meetspace/plugin-transcription";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@meetspace/ui/components/ui/select";
import { cn } from "@meetspace/utils";

import { useSttSettings } from "./context";
import { HealthStatusIndicator, useConnectionHealth } from "./health";
import { LocalModelBackendBadge, LocalModelLabel } from "./model-icon";
import {
  displayModelId,
  formatModelSize,
  LOCAL_STT_PROVIDER_ID,
  sttModelQueries,
} from "./shared";

import { useNotifications } from "~/contexts/notifications";
import { useConfigValues } from "~/shared/config";
import * as settings from "~/store/tinybase/store/settings";
import { isRealtimeLocalModel } from "~/stt/capabilities";

type ModelEntry = {
  id: string;
  isDownloaded: boolean;
  displayName?: string;
  sizeBytes?: number | null;
  mode?: "realtime" | "batch";
};

export function SelectProviderAndModel() {
  const { current_stt_provider, current_stt_model } = useConfigValues([
    "current_stt_provider",
    "current_stt_model",
  ] as const);
  const { startDownload } = useSttSettings();
  const health = useConnectionHealth();
  const models = useLocalModels();

  const setProvider = settings.UI.useSetValueCallback(
    "current_stt_provider",
    (provider: string) => provider,
    [],
    settings.STORE_ID,
  );

  const setModel = settings.UI.useSetValueCallback(
    "current_stt_model",
    (model: string) => model,
    [],
    settings.STORE_ID,
  );

  // Auto-seed the (only) provider so callers that read current_stt_provider
  // see something consistent without making the user click anything.
  useEffect(() => {
    if (current_stt_provider !== LOCAL_STT_PROVIDER_ID) {
      setProvider(LOCAL_STT_PROVIDER_ID);
    }
  }, [current_stt_provider, setProvider]);

  // Default the model on first run: prefer a realtime Parakeet, fall back to
  // the first downloaded model, then to the first available.
  useEffect(() => {
    if (current_stt_model || models.length === 0) {
      return;
    }
    const preferred =
      models.find((m) => m.mode === "realtime" && m.isDownloaded) ??
      models.find((m) => m.isDownloaded) ??
      models[0];
    if (preferred) {
      setModel(preferred.id);
    }
  }, [current_stt_model, models, setModel]);

  const isConfigured = !!current_stt_model;
  const hasError = isConfigured && health.status === "error";
  const selectedModel = models.find((m) => m.id === current_stt_model);

  return (
    <div className="flex flex-col gap-4">
      {!isConfigured && (
        <div className="border-destructive/30 bg-destructive-bg rounded-lg border px-4 py-3">
          <span className="text-destructive text-sm">
            <strong className="font-medium">Transcription model</strong> is
            needed to make Meetspace listen to your conversations.
          </span>
        </div>
      )}

      {hasError && health.message && (
        <div className="border-destructive/30 bg-destructive-bg rounded-lg border px-4 py-3">
          <span className="text-destructive text-sm">{health.message}</span>
        </div>
      )}

      <h3 className="text-md font-sans font-semibold">Transcription model</h3>
      <div data-stt-model-selector>
        <Select
          value={current_stt_model || ""}
          onValueChange={setModel}
          disabled={models.length === 0}
        >
          <SelectTrigger
            className={cn([
              "bg-background text-left shadow-none focus:ring-0",
              "[&>span]:flex [&>span]:w-full [&>span]:items-center [&>span]:justify-between [&>span]:gap-2",
              isConfigured && "[&>svg:last-child]:hidden",
            ])}
          >
            <SelectValue placeholder="Select a model">
              {selectedModel ? (
                <ModelSelectedValue model={selectedModel} />
              ) : undefined}
            </SelectValue>
            {isConfigured && <HealthStatusIndicator />}
            {isConfigured && health.status === "success" && (
              <Check className="text-success-fg -mr-1 h-4 w-4 shrink-0" />
            )}
          </SelectTrigger>
          <SelectContent align="end">
            {models.map((model) => (
              <ModelSelectItem
                key={model.id}
                model={model}
                onDownload={() => startDownload(model.id as LocalModel)}
              />
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function TranscriptionLanguageWarningBanner() {
  const hasLanguageWarning = useHasLanguageWarning();

  if (!hasLanguageWarning) {
    return null;
  }

  return (
    <div className="border-warning-border bg-warning-bg -mx-6 -mt-3 mb-6 border-b px-6 py-3">
      <span className="text-warning-fg flex items-center justify-center gap-2 text-center text-sm">
        <AlertTriangle className="size-4 shrink-0" />
        Selected model may not support all your spoken languages.
      </span>
    </div>
  );
}

function useHasLanguageWarning() {
  const { current_stt_provider, current_stt_model, spoken_languages } =
    useConfigValues([
      "current_stt_provider",
      "current_stt_model",
      "spoken_languages",
    ] as const);
  const health = useConnectionHealth();

  const isConfigured = !!(current_stt_provider && current_stt_model);
  const useLiveOnDeviceModel =
    !!current_stt_model && isRealtimeLocalModel(current_stt_model);
  const hasError = isConfigured && health.status === "error";

  const languageSupport = useQuery({
    queryKey: [
      "stt-language-support",
      current_stt_provider,
      current_stt_model,
      useLiveOnDeviceModel,
      spoken_languages,
    ],
    queryFn: async () => {
      const result = useLiveOnDeviceModel
        ? await listenerCommands.isSupportedLanguagesLive(
            current_stt_provider!,
            current_stt_model ?? null,
            spoken_languages ?? [],
          )
        : await listenerCommands.isSupportedLanguagesBatch(
            current_stt_provider!,
            current_stt_model ?? null,
            spoken_languages ?? [],
          );
      return result.status === "ok" ? result.data : true;
    },
    enabled: isConfigured && !!spoken_languages?.length,
  });

  return isConfigured && languageSupport.data === false && !hasError;
}

function useLocalModels(): ModelEntry[] {
  const targetArch = useQuery({
    queryKey: ["target-arch"],
    queryFn: () => arch(),
    staleTime: Infinity,
  });
  const isAppleSilicon = targetArch.data === "aarch64";

  const supportedModels = useQuery({
    queryKey: ["list-supported-models"],
    queryFn: async () => {
      const result = await localSttCommands.listSupportedModels();
      return result.status === "ok" ? result.data : [];
    },
    staleTime: Infinity,
  });

  const all = supportedModels.data ?? [];

  // Apple Silicon: surface Soniqo (Parakeet streaming) plus the Argmax-backed
  // models (Parakeet V2/V3 and Whisper Large V3) — both are MLX/CoreML-native.
  // Other platforms get the Whisper-CPP family.
  const soniqo = all.filter((m) => m.model_type === "soniqo");
  const argmax = all.filter((m) => m.model_type === "argmax");
  const whispercpp = all.filter((m) => m.model_type === "whispercpp");
  const visible = isAppleSilicon ? [...soniqo, ...argmax] : whispercpp;

  const downloaded = useQueries({
    queries: visible.map((m) => sttModelQueries.isDownloaded(m.key)),
  });

  return visible.map((model, i) => ({
    id: model.key,
    isDownloaded: downloaded[i]?.data ?? false,
    displayName: model.display_name,
    sizeBytes: model.size_bytes,
    mode: isRealtimeLocalModel(String(model.key)) ? "realtime" : "batch",
  }));
}

function ModelSelectItem({
  model,
  onDownload,
}: {
  model: ModelEntry;
  onDownload: () => void;
}) {
  const { activeDownloads } = useNotifications();
  const downloadInfo = activeDownloads.find((d) => d.model === model.id);
  const isDownloading = !!downloadInfo;

  const label = model.displayName ?? displayModelId(model.id);
  const sizeLabel = formatModelSize(model.sizeBytes);
  const showLocalActions = model.isDownloaded && isLocalModelId(model.id);
  const content = (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
      <LocalModelLabel
        model={model.id}
        label={label}
        className="min-w-0 flex-1"
      />
      <div className="flex shrink-0 items-center gap-2 text-[11px]">
        <LocalModelBackendBadge model={model.id} />
        {model.mode && (
          <span
            className={cn([
              "rounded-md px-1.5 py-0.5 font-medium",
              model.mode === "realtime"
                ? "bg-info-bg text-info-fg"
                : "bg-muted text-muted-foreground",
            ])}
          >
            {model.mode === "realtime" ? "Realtime" : "Batch"}
          </span>
        )}
        {!model.isDownloaded && sizeLabel && (
          <span className="text-muted-foreground font-mono">{sizeLabel}</span>
        )}
      </div>
    </div>
  );

  if (model.isDownloaded) {
    return (
      <div className="group/model-row relative">
        <SelectItem
          key={model.id}
          value={model.id}
          className={cn([showLocalActions && "pr-20"])}
        >
          {content}
        </SelectItem>
        {showLocalActions && (
          <LocalModelDropdownActions model={model.id as LocalModel} />
        )}
      </div>
    );
  }

  const handleAction = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDownloading) {
      return;
    }
    onDownload();
  };

  return (
    <div
      className={cn([
        "relative flex items-center justify-between",
        "rounded-xs px-2 py-1.5 text-sm outline-hidden",
        "cursor-pointer select-none",
        "hover:bg-accent hover:text-accent-foreground",
        "group",
      ])}
    >
      <div className="text-muted-foreground min-w-0 flex-1">{content}</div>
      {isDownloading ? (
        <span
          className={cn([
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            "flex items-center gap-1",
            "bg-secondary text-secondary-foreground border-border border",
          ])}
        >
          <Loader2 className="size-3 animate-spin" />
          <span>{Math.round(downloadInfo.progress)}%</span>
        </span>
      ) : (
        <button
          className={cn([
            "rounded-full px-2 text-[11px] font-medium",
            "opacity-0 group-hover:opacity-100",
            "transition-all duration-150",
            "bg-secondary text-secondary-foreground border-border border py-0.5 shadow-xs hover:shadow-md",
          ])}
          onClick={handleAction}
        >
          Download
        </button>
      )}
    </div>
  );
}

function ModelSelectedValue({ model }: { model: ModelEntry }) {
  return (
    <LocalModelLabel
      model={model.id}
      label={model.displayName ?? displayModelId(model.id)}
      className="min-w-0 flex-1"
    />
  );
}

function isLocalModelId(model: string): model is LocalModel {
  return (
    model.startsWith("soniqo-") ||
    model.startsWith("cactus-") ||
    model.startsWith("am-") ||
    model.startsWith("Quantized")
  );
}

function LocalModelDropdownActions({ model }: { model: LocalModel }) {
  const queryClient = useQueryClient();

  const stopSelect = (event: React.SyntheticEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleOpen = () => {
    const resultPromise = String(model).startsWith("soniqo-")
      ? localSttCommands.soniqoModelDir(model)
      : localSttCommands.modelsDir();

    void resultPromise.then((result) => {
      if (result.status === "ok") {
        void openerCommands.openPath(result.data, null);
      }
    });
  };

  const handleDelete = () => {
    void localSttCommands.deleteModel(model).then((result) => {
      if (result.status === "ok") {
        void queryClient.invalidateQueries({
          queryKey: sttModelQueries.isDownloaded(model).queryKey,
        });
      }
    });
  };

  return (
    <div
      className={cn([
        "absolute top-0 right-1 bottom-0 z-10 flex items-center justify-end gap-1 pl-6",
        "via-accent/95 to-accent bg-linear-to-r from-transparent",
        "pointer-events-none opacity-0 transition-opacity duration-150",
        "group-hover/model-row:pointer-events-auto group-hover/model-row:opacity-100",
        "group-focus-within/model-row:pointer-events-auto group-focus-within/model-row:opacity-100",
      ])}
    >
      <button
        type="button"
        aria-label="Show in Finder"
        className={cn([
          "flex size-6 items-center justify-center rounded-md",
          "text-muted-foreground hover:text-foreground",
        ])}
        onPointerDown={stopSelect}
        onClick={(event) => {
          stopSelect(event);
          handleOpen();
        }}
      >
        <FolderOpen className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label="Delete model"
        className={cn([
          "flex size-6 items-center justify-center rounded-md",
          "text-destructive hover:text-destructive",
        ])}
        onPointerDown={stopSelect}
        onClick={(event) => {
          stopSelect(event);
          handleDelete();
        }}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
