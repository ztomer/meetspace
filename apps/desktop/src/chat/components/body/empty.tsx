import {
  ListChecksIcon,
  MailIcon,
  MessageCircleIcon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react";
import { useCallback } from "react";

import { cn } from "@meetspace/utils";

import type { ContextRef } from "~/chat/context/entities";
import { useTabs } from "~/store/zustand/tabs";

const SUGGESTIONS = [
  {
    label: "Actions",
    icon: ListChecksIcon,
    prompt: "What are my action items from this meeting?",
  },
  {
    label: "Draft follow-up",
    icon: MailIcon,
    prompt: "Draft a follow-up email to the participants",
  },
  {
    label: "Key decisions",
    icon: SearchIcon,
    prompt: "What were the key decisions that have been made?",
  },
];

export function ChatBodyEmpty({
  isModelConfigured = true,
  hasContext = false,
  onSendMessage,
}: {
  isModelConfigured?: boolean;
  hasContext?: boolean;
  onSendMessage?: (
    content: string,
    parts: Array<{ type: "text"; text: string }>,
    contextRefs?: ContextRef[],
  ) => void;
}) {
  const openNew = useTabs((state) => state.openNew);

  const handleGoToSettings = useCallback(() => {
    openNew({ type: "settings", state: { tab: "intelligence" } });
  }, [openNew]);

  const handleSuggestionClick = useCallback(
    (prompt: string) => {
      onSendMessage?.(prompt, [{ type: "text", text: prompt }]);
    },
    [onSendMessage],
  );

  if (!isModelConfigured) {
    return (
      <div className="flex justify-start py-2 pb-1">
        <div className="flex w-full flex-col">
          <div className="mb-2 flex items-center gap-2">
            <MessageCircleIcon className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              Meetspace AI
            </span>
            <BetaChip />
          </div>
          <p className="mb-2 text-sm text-foreground">
            Hi, I'm Meetspace AI. Set up a language model and I'll be ready to
            help.
          </p>
          <button
            onClick={handleGoToSettings}
            className={cn([
              "inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-primary px-3 py-1.5 text-xs font-medium text-white",
              "shadow-[0_4px_14px_rgba(87,83,78,0.18)] transition-colors hover:bg-primary",
            ])}
          >
            <SparklesIcon size={12} />
            Open AI Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start pb-1">
      <div className="flex w-full flex-col">
        <div className="mb-2 flex items-center gap-2">
          <MessageCircleIcon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            Meetspace AI
          </span>
          <BetaChip />
        </div>
        <p className="mb-2 text-sm text-foreground">
          Hi, I'm Meetspace AI. I can help you pull context from your notes, find
          key decisions, and draft what comes next.
        </p>
        {hasContext && (
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map(({ label, icon: Icon, prompt }) => (
              <button
                key={label}
                onClick={() => handleSuggestionClick(prompt)}
                className={cn([
                  "inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-[11px] text-foreground",
                  "transition-colors hover:bg-muted",
                ])}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BetaChip() {
  return (
    <span className="rounded-full bg-info-bg px-1.5 py-0.5 text-[10px] font-medium text-info-fg">
      Beta
    </span>
  );
}
