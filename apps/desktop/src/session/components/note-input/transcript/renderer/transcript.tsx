import { memo, useCallback, useEffect, useMemo } from "react";

import { cn } from "@meetspace/utils";

import {
  useRenderedTranscriptSegments,
  useTranscriptOffset,
} from "./data-hooks";
import { SegmentRenderer } from "./segment";
import { EMPTY_TRANSCRIPT_SEARCH } from "./segment";
import {
  createSegmentKey,
  segmentsShallowEqual,
  useStableSegments,
} from "./segment-hooks";

import type {
  RenderLabelContext,
  Segment,
  SegmentWord,
} from "~/stt/live-segment";
import { mergeRenderedAndLiveSegments } from "~/stt/live-segment";
import { useTranscriptLabelContext } from "~/stt/queries";
import { SpeakerLabelManager } from "~/stt/segment/shared";
import { isTranscriptWordSeekable } from "~/stt/timing";

export function RenderTranscript({
  scrollElement,
  isLastTranscript,
  shouldScrollToEnd,
  transcriptId,
  liveSegments,
  currentMs,
  seek,
  startPlayback,
  audioExists,
}: {
  scrollElement: HTMLDivElement | null;
  isLastTranscript: boolean;
  shouldScrollToEnd: boolean;
  transcriptId: string;
  liveSegments: Segment[];
  currentMs: number;
  seek: (sec: number) => void;
  startPlayback: () => void;
  audioExists: boolean;
}) {
  const storedSegments = useRenderedTranscriptSegments(transcriptId);
  const mergedSegments = useMemo(
    () => mergeRenderedAndLiveSegments(storedSegments, liveSegments),
    [liveSegments, storedSegments],
  );
  const segments = useStableSegments(mergedSegments);
  const offsetMs = useTranscriptOffset(transcriptId);
  const labelContext = useTranscriptLabelContext(transcriptId);

  if (segments.length === 0) {
    return null;
  }

  return (
    <SegmentsList
      segments={segments}
      scrollElement={scrollElement}
      transcriptId={transcriptId}
      offsetMs={offsetMs}
      shouldScrollToEnd={isLastTranscript && shouldScrollToEnd}
      currentMs={currentMs}
      seek={seek}
      startPlayback={startPlayback}
      audioExists={audioExists}
      labelContext={labelContext}
    />
  );
}

const SegmentsList = memo(
  ({
    segments,
    scrollElement,
    transcriptId,
    offsetMs,
    shouldScrollToEnd,
    currentMs,
    seek,
    startPlayback,
    audioExists,
    labelContext,
  }: {
    segments: Segment[];
    scrollElement: HTMLDivElement | null;
    transcriptId: string;
    offsetMs: number;
    shouldScrollToEnd: boolean;
    currentMs: number;
    seek: (sec: number) => void;
    startPlayback: () => void;
    audioExists: boolean;
    labelContext?: RenderLabelContext;
  }) => {
    const speakerLabelManager = useMemo(() => {
      return SpeakerLabelManager.fromSegments(segments, labelContext);
    }, [segments, labelContext]);

    const seekAndPlay = useCallback(
      (word: SegmentWord) => {
        if (audioExists && isTranscriptWordSeekable(word)) {
          seek((offsetMs + word.start_ms) / 1000);
          startPlayback();
        }
      },
      [audioExists, offsetMs, seek, startPlayback],
    );

    useEffect(() => {
      if (!scrollElement || !shouldScrollToEnd) {
        return;
      }
      const raf = requestAnimationFrame(() => {
        scrollElement.scrollTo({
          top: scrollElement.scrollHeight,
          behavior: "auto",
        });
      });
      return () => cancelAnimationFrame(raf);
    }, [scrollElement, segments.length, shouldScrollToEnd]);

    return (
      <div>
        {segments.map((segment, index) => (
          <div
            key={createSegmentKey(segment, transcriptId, index)}
            className={cn([index > 0 && "pt-4"])}
          >
            <SegmentRenderer
              segment={segment}
              offsetMs={offsetMs}
              transcriptId={transcriptId}
              speakerLabelManager={speakerLabelManager}
              currentMs={currentMs}
              seekAndPlay={seekAndPlay}
              audioExists={audioExists}
              search={EMPTY_TRANSCRIPT_SEARCH}
            />
          </div>
        ))}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.transcriptId === nextProps.transcriptId &&
      prevProps.scrollElement === nextProps.scrollElement &&
      prevProps.offsetMs === nextProps.offsetMs &&
      prevProps.shouldScrollToEnd === nextProps.shouldScrollToEnd &&
      prevProps.currentMs === nextProps.currentMs &&
      prevProps.audioExists === nextProps.audioExists &&
      prevProps.labelContext === nextProps.labelContext &&
      prevProps.seek === nextProps.seek &&
      prevProps.startPlayback === nextProps.startPlayback &&
      segmentsShallowEqual(prevProps.segments, nextProps.segments)
    );
  },
);
