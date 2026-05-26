import {
  CheckCircle2Icon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  XCircleIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useEffect, useRef } from "react";

import { cn } from "@meetspace/utils";

const SCROLL_DELAY_MS = 350;

export type SectionStatus = "completed" | "active" | "upcoming";

export function OnboardingSection({
  title,
  completedTitle,
  description,
  status,
  onBack,
  onNext,
  onSkip,
  skippable = true,
  children,
}: {
  title: string;
  completedTitle?: string;
  description?: string;
  status: SectionStatus | null;
  onBack?: () => void;
  onNext?: () => void;
  onSkip?: () => void;
  skippable?: boolean;
  children: ReactNode;
}) {
  const sectionRef = useRef<HTMLElement>(null);

  const isActive = status === "active";
  const isCompleted = status === "completed";

  useEffect(() => {
    if (!isActive) return;
    const timeout = setTimeout(() => {
      sectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, SCROLL_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [isActive]);

  if (!status || status === "upcoming") return null;

  return (
    <section ref={sectionRef}>
      <div
        className={cn([
          "flex items-center gap-2 transition-all duration-300",
          isActive && "mb-6 pt-4",
        ])}
      >
        {isCompleted && (
          <CheckIcon
            className="text-success-fg size-4 shrink-0"
            strokeWidth={2.5}
          />
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2
              className={cn([
                "transition-all duration-300",
                isCompleted
                  ? "text-muted-foreground/60 text-sm font-normal"
                  : "text-foreground mb-2 font-sans text-2xl font-semibold",
              ])}
            >
              {isCompleted ? (completedTitle ?? title) : title}
            </h2>
            {isActive && (
              <div className="mb-1 flex items-center gap-2">
                {import.meta.env.DEV && onBack && (
                  <button
                    onClick={onBack}
                    aria-label="Go to previous section"
                    className="text-muted-foreground hover:text-muted-foreground rounded p-0.5 transition-colors"
                  >
                    <ChevronLeftIcon className="size-3" />
                  </button>
                )}
                {onNext &&
                  (skippable ? (
                    <button
                      onClick={() => {
                        onSkip?.();
                        onNext?.();
                      }}
                      className="text-muted-foreground hover:text-muted-foreground flex items-center gap-1 text-sm transition-colors"
                    >
                      Skip
                      <ChevronRightIcon className="size-3" />
                    </button>
                  ) : import.meta.env.DEV ? (
                    <button
                      onClick={onNext}
                      aria-label="Go to next section"
                      className="text-muted-foreground hover:text-muted-foreground rounded p-0.5 transition-colors"
                    >
                      <ChevronRightIcon className="size-3" />
                    </button>
                  ) : null)}
              </div>
            )}
          </div>
          {isActive && description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isActive && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="-mx-5 -mt-3 -mb-5 overflow-hidden px-5 pt-3 pb-5"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function OnboardingButton({
  variant = "primary",
  className,
  ...props
}: {
  variant?: "primary" | "secondary" | "ghost";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn([
        "w-fit rounded-full px-6 py-2.5 text-sm font-medium transition-all duration-200",
        variant === "primary" &&
          "border-border bg-primary hover:bg-primary border-2 text-white shadow-[0_2px_6px_rgba(87,83,78,0.22),0_10px_18px_-10px_rgba(87,83,78,0.65)]",
        variant === "secondary" &&
          "border-border text-muted-foreground hover:border-border hover:text-foreground border",
        variant === "ghost" && "text-muted-foreground hover:text-foreground",
        className,
      ])}
    />
  );
}

export function OnboardingMeetspaceIcon() {
  return (
    <img
      src="/assets/meetspace-icon.png"
      alt=""
      aria-hidden="true"
      className="size-4 object-contain object-center"
    />
  );
}

export function Divider({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="bg-accent h-px flex-1" />
      <span className="text-muted-foreground text-sm">{text}</span>
      <div className="bg-accent h-px flex-1" />
    </div>
  );
}

export function StepRow({
  status,
  label,
}: {
  status: "done" | "active" | "failed";
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {status === "done" && (
        <CheckCircle2Icon className="size-4 text-emerald-600" />
      )}
      {status === "active" && (
        <Loader2Icon className="text-muted-foreground size-4 animate-spin" />
      )}
      {status === "failed" && (
        <XCircleIcon className="text-destructive size-4" />
      )}
      <span
        className={
          status === "failed" ? "text-destructive" : "text-muted-foreground"
        }
      >
        {label}
      </span>
    </div>
  );
}
