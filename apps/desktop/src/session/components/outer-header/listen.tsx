import { MicOff } from "lucide-react";

import { DancingSticks } from "@meetspace/ui/components/ui/dancing-sticks";
import { cn } from "@meetspace/utils";

import { useListenButtonState } from "~/session/components/shared";
import { useListener } from "~/stt/contexts";

export function ListenButton({ sessionId }: { sessionId: string }) {
  const { shouldRender } = useListenButtonState(sessionId);

  if (!shouldRender) {
    return <InMeetingIndicator sessionId={sessionId} />;
  }

  return null;
}

function InMeetingIndicator({ sessionId }: { sessionId: string }) {
  const { mode, stop, amplitude, muted, degraded } = useListener((state) => ({
    mode: state.getSessionMode(sessionId),
    stop: state.stop,
    amplitude: state.live.amplitude,
    muted: state.live.muted,
    degraded: state.live.degraded,
  }));

  const active = mode === "active" || mode === "finalizing";
  const finalizing = mode === "finalizing";

  if (!active) {
    return null;
  }

  const accent = degraded ? "amber" : "red";
  const colors = {
    red: {
      button: "text-destructive hover:text-destructive bg-destructive-bg hover:bg-destructive-bg",
      sticks: "#ef4444",
      stop: "bg-destructive",
    },
    amber: {
      button:
        "text-warning hover:text-warning-fg bg-warning-bg hover:bg-warning-bg",
      sticks: "#f59e0b",
      stop: "bg-warning",
    },
  }[accent];

  return (
    <button
      type="button"
      onClick={finalizing ? undefined : stop}
      disabled={finalizing}
      className={cn([
        "group inline-flex items-center justify-center rounded-md text-sm font-medium",
        finalizing
          ? ["text-muted-foreground", "bg-muted", "cursor-wait"]
          : [colors.button],
        "h-7 w-20",
        "disabled:pointer-events-none disabled:opacity-50",
      ])}
      aria-label={finalizing ? "Finalizing" : "Stop listening"}
    >
      {finalizing ? (
        <div className="flex items-center gap-1.5">
          <span className="animate-pulse">...</span>
        </div>
      ) : (
        <>
          <div
            className={cn(["flex items-center gap-1.5", "group-hover:hidden"])}
          >
            {muted && <MicOff size={14} />}
            <DancingSticks
              amplitude={Math.min(
                Math.hypot(amplitude.mic, amplitude.speaker),
                1,
              )}
              color={colors.sticks}
              height={18}
              width={60}
            />
          </div>
          <div
            className={cn(["hidden items-center gap-1.5", "group-hover:flex"])}
          >
            <span className={cn(["size-2 rounded-none", colors.stop])} />
            <span className="text-xs">Stop</span>
          </div>
        </>
      )}
    </button>
  );
}
