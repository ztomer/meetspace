import { open as selectFolder } from "@tauri-apps/plugin-dialog";
import { CheckIcon, Loader2Icon } from "lucide-react";

import { type ImportSourceInfo } from "@meetspace/plugin-importer";
import { commands as openerCommands } from "@meetspace/plugin-opener2";
import { Button } from "@meetspace/ui/components/ui/button";

export function SourceItem({
  source,
  onScan,
  disabled,
  isScanning,
  isSuccess,
}: {
  source: ImportSourceInfo;
  onScan: () => void;
  disabled: boolean;
  isScanning: boolean;
  isSuccess?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h3 className="mb-1 text-sm font-medium">{source.name}</h3>
        <p className="text-muted-foreground text-xs">
          Import data from `
          <button
            type="button"
            onClick={() => openerCommands.revealItemInDir(source.revealPath)}
            className="hover:text-foreground cursor-pointer underline"
          >
            {source.path}
          </button>
          `
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onScan}
          disabled={disabled || isSuccess}
        >
          {isScanning ? (
            <>
              <Loader2Icon size={14} className="mr-1 animate-spin" />
              Scanning...
            </>
          ) : isSuccess ? (
            <>
              <CheckIcon size={14} className="text-success-fg mr-1" />
            </>
          ) : (
            "Scan"
          )}
        </Button>
      </div>
    </div>
  );
}

export function GoogleDriveItem({
  onImport,
  disabled,
  isImporting,
  isSuccess,
  selectedPath,
  onSelectPath,
}: {
  onImport: () => void;
  disabled: boolean;
  isImporting: boolean;
  isSuccess?: boolean;
  selectedPath: string | null;
  onSelectPath: (path: string) => void;
}) {
  const chooseFolder = async () => {
    const selected = await selectFolder({
      title: "Choose Google Takeout 'Google Drive' export folder",
      directory: true,
      multiple: false,
    });
    if (selected) {
      onSelectPath(selected);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h3 className="mb-1 text-sm font-medium">
          Google Drive (Takeout export)
        </h3>
        <p className="text-muted-foreground text-xs">
          Import a Google Takeout "Google Drive" folder export (text, markdown,
          csv, html). Point the importer at the folder you downloaded.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={chooseFolder}
          disabled={disabled}
        >
          {selectedPath ? "Change folder" : "Choose folder"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onImport}
          disabled={disabled || isSuccess || !selectedPath}
        >
          {isImporting ? (
            <>
              <Loader2Icon size={14} className="mr-1 animate-spin" />
              Importing...
            </>
          ) : isSuccess ? (
            <>
              <CheckIcon size={14} className="text-success-fg mr-1" />
            </>
          ) : (
            "Import"
          )}
        </Button>
      </div>
    </div>
  );
}
