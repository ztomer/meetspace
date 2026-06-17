import { BarChart3Icon, MicIcon, InfoIcon, ClockIcon } from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";

import { cn } from "@meetspace/utils";

import { useRenderedTranscriptSegments } from "~/session/components/note-input/transcript/renderer/data-hooks";
import * as main from "~/store/tinybase/store/main";
import { SegmentKeyUtils, SpeakerLabelManager } from "~/stt/live-segment";
import { defaultRenderLabelContext } from "~/stt/segment/shared";

const SPEAKER_COLORS = [
  {
    bar: "bg-indigo-500",
    text: "text-indigo-400",
    border: "border-indigo-500/20",
    progress: "from-indigo-600 to-indigo-400",
  },
  {
    bar: "bg-cyan-500",
    text: "text-cyan-400",
    border: "border-cyan-500/20",
    progress: "from-cyan-600 to-cyan-400",
  },
  {
    bar: "bg-violet-500",
    text: "text-violet-400",
    border: "border-violet-500/20",
    progress: "from-violet-600 to-violet-400",
  },
  {
    bar: "bg-emerald-500",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
    progress: "from-emerald-600 to-emerald-400",
  },
  {
    bar: "bg-amber-500",
    text: "text-amber-400",
    border: "border-amber-500/20",
    progress: "from-amber-600 to-amber-400",
  },
  {
    bar: "bg-rose-500",
    text: "text-rose-400",
    border: "border-rose-500/20",
    progress: "from-rose-600 to-rose-400",
  },
];

function computeIntervalUnion(
  intervals: { start: number; end: number }[],
): number {
  if (intervals.length === 0) return 0;
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  let total = 0;
  let currentStart = sorted[0].start;
  let currentEnd = sorted[0].end;
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (next.start <= currentEnd) {
      currentEnd = Math.max(currentEnd, next.end);
    } else {
      total += currentEnd - currentStart;
      currentStart = next.start;
      currentEnd = next.end;
    }
  }
  total += currentEnd - currentStart;
  return total;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
}

function getWpmCategory(wpm: number): { label: string; color: string } {
  if (wpm < 110) return { label: "Measured pace", color: "text-amber-400" };
  if (wpm <= 150) return { label: "Moderate pace", color: "text-emerald-400" };
  return { label: "Fast pace", color: "text-rose-400" };
}

export function SessionAnalytics({ sessionId }: { sessionId: string }) {
  const store = main.UI.useStore(main.STORE_ID);

  const transcriptIds =
    main.UI.useSliceRowIds(
      main.INDEXES.transcriptBySession,
      sessionId,
      main.STORE_ID,
    ) ?? [];

  const hasSpeakerHints = useMemo(() => {
    if (!store || transcriptIds.length === 0) return false;
    return transcriptIds.some((id) => {
      const hintsStr = store.getCell("transcripts", id, "speaker_hints");
      try {
        if (typeof hintsStr === "string") {
          const parsed = JSON.parse(hintsStr);
          return Array.isArray(parsed) && parsed.length > 0;
        }
      } catch {}
      return false;
    });
  }, [store, transcriptIds]);

  const segments = useRenderedTranscriptSegments(transcriptIds[0] ?? "");

  const stats = useMemo(() => {
    if (!segments || segments.length === 0) {
      return null;
    }

    const ctx = store ? defaultRenderLabelContext(store) : undefined;
    const manager = SpeakerLabelManager.fromSegments(segments, ctx);

    let totalSpeakTime = 0;
    let minStart = Number.POSITIVE_INFINITY;
    let maxEnd = Number.NEGATIVE_INFINITY;
    const speakerStatsMap = new Map<
      string,
      { speakTime: number; wordCount: number }
    >();
    const intervals: { start: number; end: number }[] = [];

    for (const segment of segments) {
      const label = SegmentKeyUtils.renderLabel(segment.key, ctx, manager);
      let segmentSpeakTime = 0;
      let segmentWordCount = 0;

      for (const word of segment.words) {
        const start = word.start_ms;
        const end = word.end_ms;
        if (start < minStart) minStart = start;
        if (end > maxEnd) maxEnd = end;

        segmentSpeakTime += end - start;
        segmentWordCount += 1;
        intervals.push({ start, end });
      }

      const current = speakerStatsMap.get(label) || {
        speakTime: 0,
        wordCount: 0,
      };
      current.speakTime += segmentSpeakTime;
      current.wordCount += segmentWordCount;
      speakerStatsMap.set(label, current);

      totalSpeakTime += segmentSpeakTime;
    }

    const speechDuration = computeIntervalUnion(intervals);
    const totalDuration =
      Number.isFinite(minStart) && Number.isFinite(maxEnd)
        ? maxEnd - minStart
        : 0;
    const silenceDuration = Math.max(0, totalDuration - speechDuration);

    const speakerStats = Array.from(speakerStatsMap.entries())
      .map(([name, stat]) => {
        const speakTimeMin = stat.speakTime / 60000;
        const wpm =
          speakTimeMin > 0 ? Math.round(stat.wordCount / speakTimeMin) : 0;
        const percentage =
          totalSpeakTime > 0 ? (stat.speakTime / totalSpeakTime) * 100 : 0;

        return {
          name,
          speakTime: stat.speakTime,
          wordCount: stat.wordCount,
          wpm,
          percentage,
        };
      })
      .sort((a, b) => b.speakTime - a.speakTime);

    return {
      totalSpeakTime,
      totalDuration,
      speechDuration,
      silenceDuration,
      speakerStats,
    };
  }, [segments, store]);

  if (transcriptIds.length === 0 || !segments || segments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
        <InfoIcon className="text-muted-foreground h-8 w-8" />
        <p className="text-muted-foreground text-sm font-medium">
          No transcript available for this session.
        </p>
      </div>
    );
  }

  if (!hasSpeakerHints) {
    return (
      <div className="bg-background/20 border-border/40 rounded-xl border p-4 backdrop-blur-md">
        <div className="flex gap-3">
          <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div className="flex flex-col gap-1 text-left">
            <h4 className="text-sm font-semibold">
              Automatic Speaker Labeling is Off
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Diarization is required to calculate speaker talk-time percentages
              and individual speaking pace.
            </p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              To enable automatic speaker separation for future sessions, go to{" "}
              <span className="text-foreground font-semibold">
                Settings → AI → Diarization
              </span>{" "}
              and turn on{" "}
              <span className="text-foreground font-semibold">
                Auto-Diarization
              </span>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex justify-center p-6">
        <ClockIcon className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  const { speechDuration, silenceDuration, totalDuration, speakerStats } =
    stats;
  const speechRatio =
    totalDuration > 0 ? (speechDuration / totalDuration) * 100 : 0;

  // SVG Radial Arc Settings
  const radius = 32;
  const strokeWidth = 6;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (speechRatio / 100) * circumference;

  return (
    <div className="flex flex-col gap-4 text-left">
      {/* Overview Grid: Speech vs Silence Gauge */}
      <div className="bg-background/30 border-border/40 flex items-center justify-between rounded-xl border p-4 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
            <svg className="h-full w-full -rotate-90 transform">
              <circle
                cx="40"
                cy="40"
                r={radius}
                className="stroke-muted-foreground/10"
                strokeWidth={strokeWidth}
                fill="none"
              />
              <motion.circle
                cx="40"
                cy="40"
                r={radius}
                className="stroke-indigo-500"
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-foreground text-base font-bold">
                {Math.round(speechRatio)}%
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <h4 className="text-foreground text-sm font-semibold">
              Speech to Silence
            </h4>
            <div className="text-muted-foreground flex flex-col gap-0.5 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-indigo-500" />
                <span>Speech: {formatDuration(speechDuration)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="bg-muted-foreground/20 h-2 w-2 rounded-full" />
                <span>Silence: {formatDuration(silenceDuration)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-right">
          <span className="text-muted-foreground block text-[10px] tracking-wider uppercase">
            Total Duration
          </span>
          <span className="text-foreground text-base font-semibold">
            {formatDuration(totalDuration)}
          </span>
        </div>
      </div>

      {/* Speaker Talk-Time list */}
      <div className="flex flex-col gap-3">
        <h4 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
          <BarChart3Icon size={14} />
          <span>Talk-time & Pace</span>
        </h4>

        <div className="flex flex-col gap-3">
          {speakerStats.map((speaker, index) => {
            const colorSet = SPEAKER_COLORS[index % SPEAKER_COLORS.length];
            const wpmInfo = getWpmCategory(speaker.wpm);

            return (
              <div
                key={speaker.name}
                className={cn([
                  "bg-background/20 border-border/30 flex flex-col gap-2 rounded-lg border p-3 shadow-sm backdrop-blur-sm",
                ])}
              >
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(["h-2.5 w-2.5 rounded-full", colorSet.bar])}
                    />
                    <span className="text-foreground font-medium">
                      {speaker.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-muted-foreground">
                      {formatDuration(speaker.speakTime)}
                    </span>
                    <span className="text-foreground font-bold">
                      {Math.round(speaker.percentage)}%
                    </span>
                  </div>
                </div>

                {/* Custom animated progress bar */}
                <div className="bg-muted-foreground/10 relative h-2.5 w-full overflow-hidden rounded-full">
                  <motion.div
                    className={cn([
                      "absolute top-0 bottom-0 left-0 rounded-full bg-gradient-to-r",
                      colorSet.progress,
                    ])}
                    initial={{ width: 0 }}
                    animate={{ width: `${speaker.percentage}%` }}
                    transition={{
                      duration: 1.2,
                      ease: "easeOut",
                      delay: index * 0.1,
                    }}
                  />
                </div>

                {/* Speaking Pace Badge */}
                <div className="mt-0.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <MicIcon size={12} className="text-muted-foreground/75" />
                    <span>{speaker.wordCount} words spoken</span>
                  </span>
                  <span className={cn(["font-medium", wpmInfo.color])}>
                    {speaker.wpm} WPM · {wpmInfo.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
