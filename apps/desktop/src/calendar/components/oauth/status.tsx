import { Trans } from "@lingui/react/macro";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@meetspace/ui/components/ui/tooltip";

export function ConnectedIndicator() {
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <span className="bg-success size-2.5 rounded-full" />
      </TooltipTrigger>
      <TooltipContent side="bottom">Connected</TooltipContent>
    </Tooltip>
  );
}
export function ReconnectRequiredIndicator() {
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <span className="bg-warning size-2.5 rounded-full" />
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <Trans>Reconnect required</Trans>
      </TooltipContent>
    </Tooltip>
  );
}
