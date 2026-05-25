import { useMutation } from "@tanstack/react-query";
import { FileTextIcon, Loader2Icon } from "lucide-react";

import { commands as openerCommands } from "@hypr/plugin-opener2";
import { DropdownMenuItem } from "@hypr/ui/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@hypr/ui/components/ui/tooltip";

import { exportSessionToNotion } from "~/integrations/notion";
import { useConfigValues } from "~/shared/config";
import * as main from "~/store/tinybase/store/main";

export function ExportToNotion({ sessionId }: { sessionId: string }) {
  const { notion_token, notion_database_id } = useConfigValues([
    "notion_token",
    "notion_database_id",
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

  const configured = !!(notion_token && notion_database_id);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const { pageUrl } = await exportSessionToNotion({
        token: notion_token!,
        databaseId: notion_database_id!,
        sessionTitle: sessionTitle ?? "Untitled",
        sessionCreatedAt: sessionCreatedAt ?? new Date().toISOString(),
        rawMd: rawMd ?? "",
      });
      return pageUrl;
    },
    onSuccess: (url) => {
      if (url) void openerCommands.openUrl(url, null);
    },
  });

  const disabled = !configured || isPending;

  const item = (
    <DropdownMenuItem
      onClick={(e) => {
        e.preventDefault();
        if (!disabled) mutate();
      }}
      disabled={disabled}
      className={disabled ? "cursor-not-allowed" : "cursor-pointer"}
    >
      {isPending ? <Loader2Icon className="animate-spin" /> : <FileTextIcon />}
      <span>{isPending ? "Exporting…" : "Send to Notion"}</span>
    </DropdownMenuItem>
  );

  if (configured) return item;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{item}</TooltipTrigger>
      <TooltipContent side="left">
        <span>Add a Notion token and database in Settings → Integrations</span>
      </TooltipContent>
    </Tooltip>
  );
}
