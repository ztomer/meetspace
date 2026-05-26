import { format } from "date-fns";
import { useCallback } from "react";

import { Button } from "@meetspace/ui/components/ui/button";
import {
  AppFloatingPanel,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@meetspace/ui/components/ui/popover";
import { cn } from "@meetspace/utils";

import { toTz, useTimezone } from "~/calendar/hooks";
import * as main from "~/store/tinybase/store/main";
import { useTabs } from "~/store/zustand/tabs";

export function SessionChip({ sessionId }: { sessionId: string }) {
  const tz = useTimezone();
  const session = main.UI.useResultRow(
    main.QUERIES.timelineSessions,
    sessionId,
    main.STORE_ID,
  );

  if (!session || !session.title) {
    return null;
  }

  const createdAt = session.created_at
    ? format(toTz(session.created_at as string, tz), "h:mm a")
    : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn([
            "flex w-full items-center gap-1 rounded pl-0.5 text-left text-xs leading-tight",
            "cursor-pointer hover:opacity-80",
          ])}
        >
          <div className="border-border w-[4px] shrink-0 self-stretch rounded-full border bg-transparent" />
          <span className="truncate">{session.title as string}</span>
          {createdAt && (
            <span className="text-muted-foreground ml-auto shrink-0 font-mono">
              {createdAt}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        variant="app"
        align="start"
        className="w-[280px]"
        onClick={(e) => e.stopPropagation()}
      >
        <AppFloatingPanel>
          <SessionPopoverContent sessionId={sessionId} />
        </AppFloatingPanel>
      </PopoverContent>
    </Popover>
  );
}

function SessionPopoverContent({ sessionId }: { sessionId: string }) {
  const session = main.UI.useResultRow(
    main.QUERIES.timelineSessions,
    sessionId,
    main.STORE_ID,
  );
  const openNew = useTabs((state) => state.openNew);
  const tz = useTimezone();

  const handleOpen = useCallback(() => {
    openNew({ type: "sessions", id: sessionId });
  }, [openNew, sessionId]);

  if (!session) {
    return null;
  }

  const createdAt = session.created_at
    ? format(toTz(session.created_at as string, tz), "MMM d, yyyy h:mm a")
    : null;

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="text-foreground text-base font-medium">
        {session.title as string}
      </div>
      <div className="bg-accent h-px" />
      {createdAt && <div className="text-foreground text-sm">{createdAt}</div>}
      <Button
        size="sm"
        className="bg-primary hover:bg-primary min-h-8 w-full text-white"
        onClick={handleOpen}
      >
        Open note
      </Button>
    </div>
  );
}
