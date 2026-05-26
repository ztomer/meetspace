import { Share2 } from "lucide-react";

import { Button } from "@meetspace/ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@meetspace/ui/components/ui/tooltip";

export function ShareButton(_: { sessionId: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground cursor-not-allowed gap-1.5 opacity-50"
          aria-label="Share"
        >
          <Share2 className="size-4" />
          <span className="hidden md:inline">Share</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <span>Coming soon</span>
      </TooltipContent>
    </Tooltip>
  );
}
