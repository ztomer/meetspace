import { open as selectFolder } from "@tauri-apps/plugin-dialog";
import { FolderOpenIcon } from "lucide-react";
import { useCallback } from "react";

import { Button } from "@meetspace/ui/components/ui/button";
import { Input } from "@meetspace/ui/components/ui/input";
import { Switch } from "@meetspace/ui/components/ui/switch";

import { useSetSettingValue } from "~/settings/queries";
import { useConfigValues } from "~/shared/config";

export function ObsidianIntegration() {
  const { obsidian_vault_path, obsidian_subfolder, obsidian_auto_export } =
    useConfigValues([
      "obsidian_vault_path",
      "obsidian_subfolder",
      "obsidian_auto_export",
    ] as const);

  const setVaultPath = useSetSettingValue("obsidian_vault_path");
  const setSubfolder = useSetSettingValue("obsidian_subfolder");
  const setAutoExport = useSetSettingValue("obsidian_auto_export");

  const chooseVault = useCallback(async () => {
    const selected = await selectFolder({
      title: "Choose your Obsidian vault folder",
      directory: true,
      multiple: false,
      defaultPath: obsidian_vault_path ?? undefined,
    });
    if (typeof selected === "string") {
      setVaultPath(selected);
    }
  }, [obsidian_vault_path, setVaultPath]);

  return (
    <section className="border-border rounded-lg border p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Obsidian</h3>
          <p className="text-muted-foreground text-xs">
            Export sessions as markdown files into your Obsidian vault.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="obsidian-vault" className="text-sm font-medium">
            Vault folder
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="obsidian-vault"
              value={obsidian_vault_path ?? ""}
              readOnly
              placeholder="No vault selected"
              className="flex-1 shadow-none"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={chooseVault}
              className="shrink-0"
            >
              <FolderOpenIcon size={14} />
              Choose…
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            The root of your Obsidian vault (the folder containing
            <code className="bg-muted mx-1 rounded px-1 py-0.5 text-[10px]">
              .obsidian/
            </code>
            ).
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="obsidian-subfolder" className="text-sm font-medium">
            Subfolder inside vault
          </label>
          <Input
            id="obsidian-subfolder"
            value={obsidian_subfolder ?? "Meetspace"}
            onChange={(e) => setSubfolder(e.target.value)}
            placeholder="Meetspace"
            className="shadow-none"
          />
          <p className="text-muted-foreground text-xs">
            Files are written to{" "}
            <code className="bg-muted rounded px-1 py-0.5 text-[10px]">
              vault/{obsidian_subfolder || "Meetspace"}/YYYY-MM-DD-title.md
            </code>
            .
          </p>
        </div>

        <div className="border-border flex items-center justify-between rounded-md border px-3 py-2">
          <div>
            <label
              htmlFor="obsidian-auto-export"
              className="text-sm font-medium"
            >
              Auto-export new sessions
            </label>
            <p className="text-muted-foreground text-xs">
              When a session finishes, write it to the vault automatically.
            </p>
          </div>
          <Switch
            id="obsidian-auto-export"
            checked={obsidian_auto_export ?? false}
            onCheckedChange={(checked) => setAutoExport(checked)}
            disabled={!obsidian_vault_path}
          />
        </div>
      </div>
    </section>
  );
}
