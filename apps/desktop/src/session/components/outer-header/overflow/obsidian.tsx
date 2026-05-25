import { useMutation } from "@tanstack/react-query";
import { BookOpenIcon, Loader2Icon } from "lucide-react";

import { commands as openerCommands } from "@hypr/plugin-opener2";
import { DropdownMenuItem } from "@hypr/ui/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@hypr/ui/components/ui/tooltip";

import { exportSessionToObsidian } from "~/integrations/obsidian";
import { useConfigValues } from "~/shared/config";
import * as main from "~/store/tinybase/store/main";

export function ExportToObsidian({ sessionId }: { sessionId: string }) {
  const { obsidian_vault_path, obsidian_subfolder } = useConfigValues([
    "obsidian_vault_path",
    "obsidian_subfolder",
  ] as const);

  const sessionTitle = main.UI.useCell(
    "sessions",
    sessionId,
    "title",
    main.STORE_ID,
  ) as string | undefined;
  const sessionCreatedAt = main.UI.useCell(
    "sessions",
    sessionId,
    "created_at",
    main.STORE_ID,
  ) as string | undefined;
  const rawMd = main.UI.useCell(
    "sessions",
    sessionId,
    "raw_md",
    main.STORE_ID,
  ) as string | undefined;

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (!obsidian_vault_path) {
        throw new Error("vault_not_configured");
      }
      const { path } = await exportSessionToObsidian({
        vaultPath: obsidian_vault_path,
        subfolder: obsidian_subfolder ?? "Anarlog",
        sessionTitle: sessionTitle ?? "Untitled",
        sessionCreatedAt: sessionCreatedAt ?? new Date().toISOString(),
        rawMd: rawMd ?? "",
      });
      return path;
    },
    onSuccess: (path) => {
      void openerCommands.openPath(path, null);
    },
  });

  const disabled = !obsidian_vault_path || isPending;

  const item = (
    <DropdownMenuItem
      onClick={(e) => {
        e.preventDefault();
        if (!disabled) mutate();
      }}
      disabled={disabled}
      className={disabled ? "cursor-not-allowed" : "cursor-pointer"}
    >
      {isPending ? (
        <Loader2Icon className="animate-spin" />
      ) : (
        <BookOpenIcon />
      )}
      <span>
        {isPending ? "Exporting…" : "Export to Obsidian"}
      </span>
    </DropdownMenuItem>
  );

  if (obsidian_vault_path) {
    return item;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>{item}</TooltipTrigger>
      <TooltipContent side="left">
        <span>Configure your Obsidian vault in Settings → Integrations</span>
      </TooltipContent>
    </Tooltip>
  );
}
