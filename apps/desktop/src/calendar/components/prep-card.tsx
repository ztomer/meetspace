import { generateText } from "ai";
import {
  Sparkles,
  Calendar,
  Users,
  CheckSquare,
  Brain,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  Loader2,
  ListTodo,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState, useMemo, useCallback } from "react";

import { isValidContent, json2md } from "@meetspace/editor/markdown";
import { Button } from "@meetspace/ui/components/ui/button";
import { cn, format, safeParseDate } from "@meetspace/utils";

import { useLanguageModel, useLLMConnectionStatus } from "~/ai/hooks";
import { useNow } from "~/calendar/hooks";
import { StandardTabWrapper } from "~/shared/main";
import { type TabItem, TabItemBase } from "~/shared/tabs";
import * as main from "~/store/tinybase/store/main";
import { useTabs, type Tab } from "~/store/zustand/tabs";

export const TabItemPrep: TabItem<Extract<Tab, { type: "prep" }>> = ({
  tab,
  tabIndex,
  handleCloseThis,
  handleSelectThis,
  handleCloseOthers,
  handleCloseAll,
  handlePinThis,
  handleUnpinThis,
}) => {
  return (
    <TabItemBase
      icon={<Sparkles className="text-primary/80 h-4 w-4" />}
      title={"Proactive Prep"}
      selected={tab.active}
      pinned={tab.pinned}
      tabIndex={tabIndex}
      handleCloseThis={() => handleCloseThis(tab)}
      handleSelectThis={() => handleSelectThis(tab)}
      handleCloseOthers={handleCloseOthers}
      handleCloseAll={handleCloseAll}
      handlePinThis={() => handlePinThis(tab)}
      handleUnpinThis={() => handleUnpinThis(tab)}
    />
  );
};

export function TabContentPrep() {
  return (
    <StandardTabWrapper>
      <div className="bg-background/5 flex h-full flex-col overflow-hidden p-6">
        <ProactivePrepView />
      </div>
    </StandardTabWrapper>
  );
}

function ProactivePrepView() {
  const now = useNow();
  const openNew = useTabs((state) => state.openNew);

  const eventsTable = main.UI.useTable("events", main.STORE_ID);
  const humansTable = main.UI.useTable("humans", main.STORE_ID);
  const mappingTable = main.UI.useTable(
    "mapping_session_participant",
    main.STORE_ID,
  );
  const sessionsTable = main.UI.useTable("sessions", main.STORE_ID);

  const llmStatus = useLLMConnectionStatus();
  const model = useLanguageModel();

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [aiDigests, setAiDigests] = useState<Record<string, string>>({});
  const [loadingAi, setLoadingAi] = useState<Record<string, boolean>>({});

  // 1. Filter and sort upcoming events (today & tomorrow)
  const upcomingEvents = useMemo(() => {
    if (!eventsTable) return [];
    const nowMs = now.getTime();

    return Object.entries(eventsTable)
      .map(([id, event]) => ({ id, ...event }))
      .filter((event) => {
        const start = event.started_at
          ? new Date(event.started_at).getTime()
          : 0;
        // Keep events that start in the future or started in the last 30 minutes
        return start > nowMs - 30 * 60 * 1000;
      })
      .sort((a, b) => {
        const startA = a.started_at ? new Date(a.started_at).getTime() : 0;
        const startB = b.started_at ? new Date(b.started_at).getTime() : 0;
        return startA - startB;
      });
  }, [eventsTable, now]);

  // 2. Perform SQLite-style roster cross-referencing and past sessions lookup
  const prepDataList = useMemo(() => {
    if (!upcomingEvents || upcomingEvents.length === 0) return [];

    const humansByEmail = new Map<string, string>();
    for (const [humanId, human] of Object.entries(humansTable ?? {})) {
      if (human.email) {
        humansByEmail.set(human.email.toLowerCase().trim(), humanId);
      }
    }

    return upcomingEvents.map(({ id: eventId, ...event }) => {
      let participants: { name?: string; email?: string }[] = [];
      try {
        if (event.participants_json) {
          participants = JSON.parse(event.participants_json);
        }
      } catch {}

      // Cross-reference event attendees with our database contact human IDs
      const matchedHumanIds = participants
        .map((p) =>
          p.email ? humansByEmail.get(p.email.toLowerCase().trim()) : undefined,
        )
        .filter((id): id is string => typeof id === "string");

      // Find past sessions containing these attendees
      const sessionMatchCounts = new Map<string, number>();
      for (const humanId of matchedHumanIds) {
        for (const mapping of Object.values(mappingTable ?? {})) {
          if (mapping.human_id === humanId && mapping.session_id) {
            const sid = mapping.session_id;
            const session = sessionsTable?.[sid];
            if (session) {
              sessionMatchCounts.set(
                sid,
                (sessionMatchCounts.get(sid) || 0) + 1,
              );
            }
          }
        }
      }

      // Sort matched sessions by number of shared contacts, then date
      const matchedSessions = Array.from(sessionMatchCounts.entries())
        .map(([sessionId, count]) => {
          const session = sessionsTable?.[sessionId];
          return {
            id: sessionId,
            title: session?.title || "Untitled Session",
            created_at: session?.created_at || "",
            raw_md: session?.raw_md || "",
            matchCount: count,
          };
        })
        .sort((a, b) => {
          if (b.matchCount !== a.matchCount) {
            return b.matchCount - a.matchCount;
          }
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        });

      const mostRecentSession = matchedSessions[0] || null;

      // Extract outstanding checklist checkbox items (- [ ]) from previous meeting notes
      const outstandingTasks: string[] = [];
      if (mostRecentSession && mostRecentSession.raw_md) {
        let md = mostRecentSession.raw_md;
        try {
          if (md.trim().startsWith("{")) {
            const parsed = JSON.parse(md);
            if (isValidContent(parsed)) {
              md = json2md(parsed);
            }
          }
        } catch {}

        const checkboxRegex = /-\s*\[\s*\]\s*(.+)/g;
        let match;
        while ((match = checkboxRegex.exec(md)) !== null) {
          if (match[1] && match[1].trim()) {
            outstandingTasks.push(match[1].trim());
          }
        }
      }

      return {
        eventId,
        event,
        participants,
        matchedHumanIds,
        mostRecentSession,
        outstandingTasks,
      };
    });
  }, [upcomingEvents, humansTable, mappingTable, sessionsTable]);

  // Set default selection
  useMemo(() => {
    if (!selectedEventId && prepDataList.length > 0 && prepDataList[0]) {
      setSelectedEventId(prepDataList[0].eventId);
    }
  }, [prepDataList, selectedEventId]);

  const selectedPrepData = useMemo(() => {
    return prepDataList.find((d) => d.eventId === selectedEventId) || null;
  }, [prepDataList, selectedEventId]);

  // AI digest generator using Vercel AI SDK
  const handleGenerateDigest = useCallback(
    async (
      eventId: string,
      mostRecentSession: any,
      upcomingTitle: string,
      participantNames: string[],
    ) => {
      if (!model) return;
      setLoadingAi((prev) => ({ ...prev, [eventId]: true }));

      try {
        let notesMd = mostRecentSession?.raw_md || "";
        try {
          if (notesMd.trim().startsWith("{")) {
            const parsed = JSON.parse(notesMd);
            if (isValidContent(parsed)) {
              notesMd = json2md(parsed);
            }
          }
        } catch {}

        const prompt = `You are a helpful meeting preparation assistant.
Below are the notes from the last meeting.
Upcoming meeting: "${upcomingTitle}"
Participants in upcoming meeting: ${participantNames.join(", ")}

Last Meeting Notes:
"""
${notesMd.slice(0, 3000)}
"""

Please formulate a highly structured, professional, and concise preparation digest for this upcoming meeting. 
Include:
1. Quick background / context synthesis from the last meeting.
2. 2-3 key talking points or questions the user should ask based on unresolved topics.
Keep it bullet-pointed, direct, and under 150 words total. Do not output conversational filler.`;

        const response = await generateText({
          model,
          prompt,
        });

        setAiDigests((prev) => ({ ...prev, [eventId]: response.text }));
      } catch (err) {
        console.error("[Proactive Prep] LLM Gen failed", err);
        setAiDigests((prev) => ({
          ...prev,
          [eventId]:
            "Failed to generate AI digest. Verify your local LLM server is responding.",
        }));
      } finally {
        setLoadingAi((prev) => ({ ...prev, [eventId]: false }));
      }
    },
    [model],
  );

  return (
    <div className="flex h-full flex-1 flex-col gap-6 overflow-hidden text-left">
      {/* Header and status bar */}
      <div className="border-border/20 flex shrink-0 flex-col gap-2 border-b pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="text-primary h-6 w-6 animate-pulse" />
            <h1 className="text-foreground text-xl font-bold tracking-tight">
              Proactive Prep
            </h1>
          </div>

          {/* Local LLM status checklist */}
          <div className="flex items-center gap-2">
            {llmStatus.status === "success" ? (
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                <CheckCircle2 size={12} />
                <span>Local AI Ready</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
                <AlertCircle size={12} />
                <span>Local AI Offline</span>
              </span>
            )}
          </div>
        </div>
        <p className="text-muted-foreground text-sm">
          Meetspace scans your upcoming agenda and cross-references attendees
          with past local meetings, pulling unresolved checklists and
          summarizing context entirely on-device.
        </p>
      </div>

      {prepDataList.length === 0 ? (
        <div className="bg-background/25 border-border/30 flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border p-8 text-center backdrop-blur-md">
          <Calendar className="text-muted-foreground/60 h-12 w-12" />
          <h3 className="text-base font-semibold">
            No Upcoming Meetings Found
          </h3>
          <p className="text-muted-foreground max-w-sm text-sm">
            We couldn't locate any upcoming meetings in the next 48 hours.
            Ensure your calendars are synchronized.
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-6 overflow-hidden">
          {/* Left panel: Agenda list */}
          <div className="scrollbar-hide flex w-[340px] shrink-0 flex-col gap-3 overflow-y-auto pr-2">
            <h3 className="text-muted-foreground pl-1 text-xs font-semibold tracking-wider uppercase">
              Agenda Timeline
            </h3>
            {prepDataList.map(
              ({ eventId, event, participants, mostRecentSession }) => {
                const selected = eventId === selectedEventId;
                const dateObj = safeParseDate(event.started_at);
                const timeStr = dateObj ? format(dateObj, "h:mm a") : "";
                const dateStr = dateObj ? format(dateObj, "EEE, MMM d") : "";

                return (
                  <button
                    key={eventId}
                    onClick={() => setSelectedEventId(eventId)}
                    className={cn([
                      "flex w-full cursor-pointer flex-col gap-2.5 rounded-xl border p-4 text-left shadow-sm backdrop-blur-md transition-all duration-200",
                      selected
                        ? "bg-accent/40 border-primary/40 shadow-primary/5 ring-primary/25 ring-1"
                        : "bg-background/25 border-border/30 hover:bg-accent/20 hover:border-border/60",
                    ])}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-primary font-mono text-xs font-medium">
                        {timeStr} · {dateStr}
                      </span>
                      {mostRecentSession && (
                        <span className="py-0.2 border-primary/20 bg-primary/10 text-primary rounded-full border px-1.5 text-[9px] font-bold">
                          Has History
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <h4 className="text-foreground line-clamp-1 text-sm font-semibold">
                        {event.title || "Untitled Meeting"}
                      </h4>
                      <span className="text-muted-foreground flex items-center gap-1 text-xs">
                        <Users size={12} className="shrink-0" />
                        <span className="truncate">
                          {participants.length} attendees
                        </span>
                      </span>
                    </div>
                  </button>
                );
              },
            )}
          </div>

          {/* Right panel: Context and preparation details */}
          <div className="bg-background/20 border-border/30 flex flex-1 flex-col gap-5 overflow-y-auto rounded-2xl border p-6 pr-1 shadow-sm backdrop-blur-md">
            <AnimatePresence mode="wait">
              {selectedPrepData && (
                <motion.div
                  key={selectedPrepData.eventId}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-5"
                >
                  {/* Event Meta Header */}
                  <div className="border-border/10 flex flex-col gap-2 border-b pb-4">
                    <div className="flex items-start justify-between">
                      <h2 className="text-foreground text-lg font-bold">
                        {selectedPrepData.event.title || "Untitled Meeting"}
                      </h2>
                      {selectedPrepData.event.meeting_link && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex items-center gap-1 rounded-lg text-xs"
                          onClick={() =>
                            window.open(
                              selectedPrepData.event.meeting_link,
                              "_blank",
                            )
                          }
                        >
                          <ExternalLink size={12} />
                          <span>Join Meeting</span>
                        </Button>
                      )}
                    </div>

                    <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar size={12} />
                        {selectedPrepData.event.started_at
                          ? format(
                              new Date(selectedPrepData.event.started_at),
                              "PPPP 'at' p",
                            )
                          : ""}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Users size={12} />
                        <span>
                          {selectedPrepData.participants.length} attendees
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Context digest and digest warnings */}
                  {!selectedPrepData.mostRecentSession ? (
                    <div className="bg-muted/10 border-border/20 flex flex-col items-center gap-2 rounded-xl border p-5 text-center">
                      <InfoIcon className="text-muted-foreground/60 h-8 w-8" />
                      <h4 className="text-sm font-semibold">
                        No Past Meeting History Available
                      </h4>
                      <p className="text-muted-foreground max-w-sm text-xs">
                        None of the attendees in this meeting have past notes
                        stored in your Meetspace database.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Past Meeting History Details */}
                      <div className="flex flex-col gap-3">
                        <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                          <CheckCircle2 size={14} className="text-primary" />
                          <span>Last Shared Context</span>
                        </h3>
                        <div className="bg-background/30 border-border/30 flex items-center justify-between rounded-xl border p-4 shadow-xs">
                          <div className="flex flex-col gap-1">
                            <span className="text-primary font-mono text-xs">
                              Previous Session on{" "}
                              {format(
                                new Date(
                                  selectedPrepData.mostRecentSession.created_at,
                                ),
                                "MMM d, yyyy",
                              )}
                            </span>
                            <span className="text-foreground max-w-lg truncate text-sm font-semibold">
                              {selectedPrepData.mostRecentSession.title}
                            </span>
                          </div>

                          <button
                            onClick={() =>
                              openNew({
                                type: "sessions",
                                id: selectedPrepData.mostRecentSession.id,
                              })
                            }
                            className="text-primary hover:text-primary/80 flex cursor-pointer items-center gap-1 text-xs font-medium"
                          >
                            <span>Open Notes</span>
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Outstanding Checkboxes */}
                      <div className="flex flex-col gap-3">
                        <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                          <ListTodo size={14} className="text-primary" />
                          <span>
                            Unresolved Action Items (
                            {selectedPrepData.outstandingTasks.length})
                          </span>
                        </h3>
                        {selectedPrepData.outstandingTasks.length === 0 ? (
                          <div className="bg-muted/10 border-border/10 text-muted-foreground rounded-xl border px-4 py-3 text-sm">
                            All action items from the previous notes have been
                            completed!
                          </div>
                        ) : (
                          <div className="bg-background/25 border-border/20 flex flex-col gap-2 rounded-xl border p-4 shadow-xs">
                            {selectedPrepData.outstandingTasks.map(
                              (task, idx) => (
                                <div
                                  key={idx}
                                  className="text-foreground flex items-start gap-2.5 text-xs"
                                >
                                  <CheckSquare
                                    size={13}
                                    className="text-primary mt-0.5 shrink-0"
                                  />
                                  <span className="leading-relaxed select-text">
                                    {task}
                                  </span>
                                </div>
                              ),
                            )}
                          </div>
                        )}
                      </div>

                      {/* Local RAG AI Digest summary */}
                      <div className="border-border/10 flex flex-col gap-3 border-t pt-5">
                        <h3 className="text-muted-foreground flex items-center justify-between text-xs font-semibold tracking-wider uppercase">
                          <span className="flex items-center gap-1.5">
                            <Brain size={14} className="text-primary" />
                            <span>AI Preparation Digest</span>
                          </span>

                          {llmStatus.status !== "success" && (
                            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400 select-none">
                              AI Setup Needed
                            </span>
                          )}
                        </h3>

                        {/* Setup prompt warn / health checklist */}
                        {llmStatus.status !== "success" ? (
                          <div className="text-muted-foreground flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-relaxed">
                            <AlertCircle
                              size={16}
                              className="mt-0.5 shrink-0 text-amber-500"
                            />
                            <div className="flex flex-col gap-1">
                              <span className="font-semibold text-amber-400">
                                Local AI Summaries Unavailable
                              </span>
                              <span>
                                Summarization is completely local. Connect a
                                running model provider (e.g. Ollama or Osaurus
                                running locally) in settings to enable this
                                synthesis.
                              </span>
                              <button
                                onClick={() =>
                                  openNew({
                                    type: "settings",
                                    state: { tab: "intelligence" },
                                  })
                                }
                                className="text-primary hover:text-primary/80 mt-1.5 cursor-pointer self-start font-medium underline"
                              >
                                Configure Local LLM Server →
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3">
                            {/* Generation trigger */}
                            {!aiDigests[selectedPrepData.eventId] &&
                              !loadingAi[selectedPrepData.eventId] && (
                                <Button
                                  onClick={() =>
                                    handleGenerateDigest(
                                      selectedPrepData.eventId,
                                      selectedPrepData.mostRecentSession,
                                      selectedPrepData.event.title || "",
                                      selectedPrepData.participants.map(
                                        (p) => p.name || p.email || "Someone",
                                      ),
                                    )
                                  }
                                  size="sm"
                                  className="border-border bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1.5 self-start rounded-xl px-4 py-2 font-medium"
                                >
                                  <Sparkles size={14} />
                                  <span>Synthesize Meeting Context</span>
                                </Button>
                              )}

                            {/* Loading state */}
                            {loadingAi[selectedPrepData.eventId] && (
                              <div className="border-primary/10 bg-primary/5 flex flex-col items-center justify-center gap-2 rounded-xl border p-6 text-center">
                                <Loader2
                                  size={20}
                                  className="text-primary animate-spin"
                                />
                                <span className="text-muted-foreground text-xs">
                                  Reading previous notes & synthesizing
                                  preparation digest...
                                </span>
                              </div>
                            )}

                            {/* Digest content with premium typing box */}
                            {aiDigests[selectedPrepData.eventId] && (
                              <div className="border-primary/10 bg-primary/5 relative overflow-hidden rounded-xl border p-4 shadow-sm">
                                <div className="absolute top-2 right-2 flex items-center opacity-40">
                                  <Brain size={16} className="text-primary" />
                                </div>
                                <div className="text-foreground pr-6 text-left text-xs leading-relaxed whitespace-pre-wrap select-text">
                                  {aiDigests[selectedPrepData.eventId]}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoIcon(props: { className?: string }) {
  return <AlertCircle {...props} />;
}
