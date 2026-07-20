import { useMutation, useQuery } from "@tanstack/react-query";
import { XCircleIcon } from "lucide-react";
import { useState } from "react";

import { commands as analyticsCommands } from "@meetspace/plugin-analytics";
import {
  commands,
  type ImportSourceInfo,
  type ImportSourceKind,
  type ImportStats,
} from "@meetspace/plugin-importer";

import { GoogleDriveItem, SourceItem } from "./source-item";

import { StyledStreamdown } from "~/settings/ai/shared";

type DryRunResult = {
  source: ImportSourceKind;
  stats: ImportStats;
};

export function Data() {
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [successfulSource, setSuccessfulSource] =
    useState<ImportSourceKind | null>(null);
  const [googleDrivePath, setGoogleDrivePath] = useState<string | null>(null);
  const [googleDriveSuccess, setGoogleDriveSuccess] = useState(false);

  const { data: sources } = useQuery({
    queryKey: ["import-sources"],
    queryFn: async () => {
      const result = await commands.listAvailableSources();
      if (result.status === "error") {
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const importMutation = useMutation({
    mutationFn: async (source: ImportSourceKind) => {
      const result = await commands.runImport(source, "");
      if (result.status === "error") {
        throw new Error(result.error);
      }

      return result.data.stats;
    },
    onSuccess: () => {
      const source = dryRunResult?.source;
      void analyticsCommands.event({
        event: "data_imported",
        source,
      });
      if (source) {
        setSuccessfulSource(source);
      }
      setDryRunResult(null);
    },
  });

  const dryImportMutation = useMutation({
    mutationFn: async (source: ImportSourceKind) => {
      const result = await commands.runImportDry(source);
      if (result.status === "error") {
        throw new Error(result.error);
      }
      return { source, stats: result.data };
    },
    onSuccess: (result) => {
      setDryRunResult(result);
    },
  });

  const googleDriveMutation = useMutation({
    mutationFn: async (path: string) => {
      const result = await commands.runImportWithPath("google_drive", path, "");
      if (result.status === "error") {
        throw new Error(result.error);
      }
      return result.data.stats;
    },
    onSuccess: () => {
      setGoogleDriveSuccess(true);
    },
  });

  const isPending =
    importMutation.isPending ||
    dryImportMutation.isPending ||
    googleDriveMutation.isPending;

  return (
    <div>
      <StyledStreamdown className="text-muted-foreground">
        {
          "Import data from other apps. Read more about [import](https://char.com/docs/data/#import) and [export](https://char.com/docs/data/#export)."
        }
      </StyledStreamdown>

      <div className="mt-4 flex flex-col gap-3">
        {sources
          ?.filter(
            (source): source is ImportSourceInfo & { kind: ImportSourceKind } =>
              source.kind !== null,
          )
          .map((source) => (
            <SourceItem
              key={source.kind}
              source={source}
              onScan={() => {
                setSuccessfulSource(null);
                dryImportMutation.mutate(source.kind);
              }}
              disabled={isPending}
              isScanning={
                dryImportMutation.isPending &&
                dryImportMutation.variables === source.kind
              }
              isSuccess={successfulSource === source.kind}
            />
          ))}

        <GoogleDriveItem
          selectedPath={googleDrivePath}
          onSelectPath={(path) => {
            setGoogleDriveSuccess(false);
            setGoogleDrivePath(path);
          }}
          onImport={() => {
            if (googleDrivePath) {
              setGoogleDriveSuccess(false);
              googleDriveMutation.mutate(googleDrivePath);
            }
          }}
          disabled={isPending}
          isImporting={googleDriveMutation.isPending}
          isSuccess={googleDriveSuccess}
        />

        {(importMutation.isError ||
          dryImportMutation.isError ||
          googleDriveMutation.isError) && (
          <div className="text-destructive flex items-center gap-2 text-xs">
            <XCircleIcon size={14} />
            <span>
              {importMutation.isError
                ? `Import failed: ${importMutation.error.message}`
                : dryImportMutation.isError
                  ? `Scan failed: ${dryImportMutation.error.message}`
                  : `Google Drive import failed: ${googleDriveMutation.error?.message}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
