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
            <MessageCircleIcon className="text-muted-foreground size-4" />
            <span className="text-foreground text-sm font-medium">
              Meetspace AI
            </span>
            <BetaChip />
          </div>
          <p className="text-foreground mb-2 text-sm">
            Hi, I'm Meetspace AI. Set up a language model and I'll be ready to
            help.
          </p>
          <button
            onClick={handleGoToSettings}
            className={cn([
              "border-border bg-primary inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-white",
              "hover:bg-primary shadow-[0_4px_14px_rgba(87,83,78,0.18)] transition-colors",
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
          <MessageCircleIcon className="text-muted-foreground size-4" />
          <span className="text-foreground text-sm font-medium">
            Meetspace AI
          </span>
          <BetaChip />
        </div>
        <p className="text-foreground mb-2 text-sm">
          Hi, I'm Meetspace AI. I can help you pull context from your notes,
          find key decisions, and draft what comes next.
        </p>
        {hasContext && (
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map(({ label, icon: Icon, prompt }) => (
              <button
                key={label}
                onClick={() => handleSuggestionClick(prompt)}
                className={cn([
                  "border-border bg-background text-foreground inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px]",
                  "hover:bg-muted transition-colors",
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
    <span className="bg-info-bg text-info-fg rounded-full px-1.5 py-0.5 text-[10px] font-medium">
      Beta
    </span>
  );
}
