import { useMemo } from "react";

import { cn } from "@meetspace/utils";

import { SpeakerAssignPopover } from "./speaker-assign";
import { useSegmentColor } from "./utils";

import type { RenderLabelContext, Segment } from "~/stt/live-segment";
import { SegmentKeyUtils, SpeakerLabelManager } from "~/stt/live-segment";
import { useTranscriptLabelContext } from "~/stt/queries";

export function SegmentHeader({
  segment,
  transcriptId,
  speakerLabelManager,
}: {
  segment: Segment;
  transcriptId: string;
  speakerLabelManager?: SpeakerLabelManager;
}) {
  const color = useSegmentColor(segment.key);
  const labelContext = useTranscriptLabelContext(transcriptId);
  const label = useSpeakerLabel(segment.key, speakerLabelManager, labelContext);
  const timestamp = "";
  const headerClassName = cn([
    "bg-muted sticky top-0 z-20",
    "-mx-3 px-3 py-1",
    "text-xs font-light",
    "flex items-center justify-between",
  ]);

  return (
    <div className={headerClassName}>
      <SpeakerAssignPopover
        segment={segment}
        transcriptId={transcriptId}
        color={color}
        label={label}
      />
      <span className="text-muted-foreground font-mono">{timestamp}</span>
    </div>
  );
}

function useSpeakerLabel(
  key: Segment["key"],
  manager?: SpeakerLabelManager,
  labelContext?: RenderLabelContext,
) {
  return useMemo(() => {
    return SegmentKeyUtils.renderLabel(key, labelContext, manager);
  }, [key, manager, labelContext]);
}
