import { useMutation } from "@tanstack/react-query";
import { BookOpenIcon, Loader2Icon } from "lucide-react";

import { commands as openerCommands } from "@meetspace/plugin-opener2";
import { DropdownMenuItem } from "@meetspace/ui/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@meetspace/ui/components/ui/tooltip";

import { exportSessionToObsidian } from "~/integrations/obsidian";
import { useSession } from "~/session/queries";
import { useConfigValues } from "~/shared/config";

export function ExportToObsidian({ sessionId }: { sessionId: string }) {
  const { obsidian_vault_path, obsidian_subfolder } = useConfigValues([
    "obsidian_vault_path",
    "obsidian_subfolder",
  ] as const);

  const session = useSession(sessionId);
  const sessionTitle = session?.title;
  const sessionCreatedAt = session?.created_at;
  const rawMd = session?.raw_md;

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (!obsidian_vault_path) {
        throw new Error("vault_not_configured");
      }
      const { path } = await exportSessionToObsidian({
        vaultPath: obsidian_vault_path,
        subfolder: obsidian_subfolder ?? "Meetspace",
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
      {isPending ? <Loader2Icon className="animate-spin" /> : <BookOpenIcon />}
      <span>{isPending ? "Exporting…" : "Export to Obsidian"}</span>
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
