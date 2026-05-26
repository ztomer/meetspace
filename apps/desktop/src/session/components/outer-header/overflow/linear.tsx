import { useMutation, useQuery } from "@tanstack/react-query";
import { CircleDotIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";

import { commands as openerCommands } from "@meetspace/plugin-opener2";
import { Button } from "@meetspace/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@meetspace/ui/components/ui/dialog";
import { DropdownMenuItem } from "@meetspace/ui/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@meetspace/ui/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@meetspace/ui/components/ui/tooltip";

import { createLinearIssue, listLinearTeams } from "~/integrations/linear";
import { useConfigValues } from "~/shared/config";
import * as main from "~/store/tinybase/store/main";
import * as settings from "~/store/tinybase/store/settings";

export function CreateLinearIssue({ sessionId }: { sessionId: string }) {
  const { linear_api_key, linear_team_id } = useConfigValues([
    "linear_api_key",
    "linear_team_id",
  ] as const);

  const [teamPickerOpen, setTeamPickerOpen] = useState(false);

  const sessionTitle = main.UI.useCell(
    "sessions",
    sessionId,
    "title",
    main.STORE_ID,
  ) as string | undefined;
  const rawMd = main.UI.useCell(
    "sessions",
    sessionId,
    "raw_md",
    main.STORE_ID,
  ) as string | undefined;

  const setTeamId = settings.UI.useSetValueCallback(
    "linear_team_id",
    (v: string) => v,
    [],
    settings.STORE_ID,
  );

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const { issueUrl } = await createLinearIssue({
        apiKey: linear_api_key!,
        teamId: linear_team_id!,
        title: sessionTitle ?? "Untitled",
        description: rawMd ?? "",
      });
      return issueUrl;
    },
    onSuccess: (url) => {
      if (url) void openerCommands.openUrl(url, null);
    },
  });

  const hasKey = !!linear_api_key;
  const disabled = !hasKey || isPending;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!hasKey) return;
    if (!linear_team_id) {
      setTeamPickerOpen(true);
      return;
    }
    mutate();
  };

  const item = (
    <DropdownMenuItem
      onClick={handleClick}
      disabled={disabled}
      className={disabled ? "cursor-not-allowed" : "cursor-pointer"}
    >
      {isPending ? <Loader2Icon className="animate-spin" /> : <CircleDotIcon />}
      <span>{isPending ? "Creating…" : "Create Linear issue"}</span>
    </DropdownMenuItem>
  );

  return (
    <>
      {hasKey ? (
        item
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>{item}</TooltipTrigger>
          <TooltipContent side="left">
            <span>Add a Linear API key in Settings → Integrations</span>
          </TooltipContent>
        </Tooltip>
      )}
      <LinearTeamPickerDialog
        open={teamPickerOpen}
        onOpenChange={setTeamPickerOpen}
        apiKey={linear_api_key ?? ""}
        onChosen={(teamId) => {
          setTeamId(teamId);
          setTeamPickerOpen(false);
          // Fire the issue create now that we have a team.
          setTimeout(() => mutate(), 0);
        }}
      />
    </>
  );
}

function LinearTeamPickerDialog({
  open,
  onOpenChange,
  apiKey,
  onChosen,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiKey: string;
  onChosen: (teamId: string) => void;
}) {
  const [selected, setSelected] = useState<string>("");

  const teams = useQuery({
    queryKey: ["linear-teams", apiKey],
    queryFn: () => listLinearTeams(apiKey),
    enabled: open && !!apiKey,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pick a Linear team</DialogTitle>
        </DialogHeader>
        {teams.isPending && open ? (
          <p className="text-sm text-muted-foreground">Loading teams…</p>
        ) : teams.isError ? (
          <p className="text-sm text-destructive">
            Could not load teams. Check the API key.
          </p>
        ) : (
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger>
              <SelectValue placeholder="Select a team" />
            </SelectTrigger>
            <SelectContent>
              {teams.data?.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name} ({team.key})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!selected}
            onClick={() => selected && onChosen(selected)}
          >
            Use this team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
