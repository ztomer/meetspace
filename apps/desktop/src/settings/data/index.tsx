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

import { SourceItem } from "./source-item";

import { StyledStreamdown } from "~/settings/ai/shared";

type DryRunResult = {
  source: ImportSourceKind;
  stats: ImportStats;
};

export function Data() {
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [successfulSource, setSuccessfulSource] =
    useState<ImportSourceKind | null>(null);

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

  const isPending = importMutation.isPending || dryImportMutation.isPending;

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

        {(importMutation.isError || dryImportMutation.isError) && (
          <div className="text-destructive flex items-center gap-2 text-xs">
            <XCircleIcon size={14} />
            <span>
              {importMutation.isError
                ? `Import failed: ${importMutation.error.message}`
                : `Scan failed: ${dryImportMutation.error?.message}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
