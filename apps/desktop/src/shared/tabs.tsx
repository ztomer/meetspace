import { AlertCircleIcon, Pin, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@meetspace/ui/components/ui/button";
import { Kbd } from "@meetspace/ui/components/ui/kbd";
import {
  AppFloatingPanel,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@meetspace/ui/components/ui/popover";
import { Spinner } from "@meetspace/ui/components/ui/spinner";
import { useCmdKeyPressed } from "@meetspace/ui/hooks/use-cmd-key-pressed";
import { cn } from "@meetspace/utils";

import { InteractiveButton } from "~/shared/ui/interactive-button";
import { type Tab } from "~/store/zustand/tabs";

type TabItemProps<T extends Tab = Tab> = { tab: T; tabIndex?: number } & {
  handleSelectThis: (tab: T) => void;
  handleCloseThis: (tab: T) => void;
  handleCloseOthers: () => void;
  handleCloseAll: () => void;
  handlePinThis: (tab: T) => void;
  handleUnpinThis: (tab: T) => void;
  pendingCloseConfirmationTab?: Tab | null;
  setPendingCloseConfirmationTab?: (tab: Tab | null) => void;
};

type TabAccent = "neutral" | "red" | "amber" | "blue";

const accentColors: Record<
  TabAccent,
  {
    selected: string[];
    unselected: string[];
    hover: { selected: string; unselected: string };
  }
> = {
  neutral: {
    selected: [
      "bg-accent/50",
      "hover:bg-accent",
      "text-foreground",
      "border-border",
    ],
    unselected: [
      "bg-muted",
      "hover:bg-muted",
      "text-muted-foreground",
      "border-transparent",
    ],
    hover: {
      selected: "text-foreground hover:text-foreground",
      unselected: "text-muted-foreground hover:text-foreground",
    },
  },
  red: {
    selected: ["bg-destructive-bg", "text-destructive", "border-destructive"],
    unselected: ["bg-destructive-bg", "text-destructive", "border-transparent"],
    hover: {
      selected: "text-destructive hover:text-destructive",
      unselected: "text-destructive hover:text-destructive",
    },
  },
  amber: {
    selected: ["bg-warning-bg", "text-warning-fg", "border-warning"],
    unselected: ["bg-warning-bg", "text-warning", "border-transparent"],
    hover: {
      selected: "text-warning-fg hover:text-warning-fg",
      unselected: "text-warning-fg hover:text-warning-fg",
    },
  },
  blue: {
    selected: ["bg-info-bg", "text-info-fg", "border-info"],
    unselected: ["bg-info-bg", "text-info", "border-transparent"],
    hover: {
      selected: "text-info hover:text-info-fg",
      unselected: "text-info hover:text-info-fg",
    },
  },
};

import type { TabStatus } from "~/session/tab-visual-state";

function statusToAccent(status: TabStatus | undefined): TabAccent {
  switch (status) {
    case "listening":
      return "red";
    case "listening-degraded":
      return "amber";
    default:
      return "neutral";
  }
}

function statusRequiresConfirmation(status: TabStatus | undefined): boolean {
  return (
    status === "listening" ||
    status === "listening-degraded" ||
    status === "finalizing"
  );
}

function statusShowsSpinner(status: TabStatus | undefined): boolean {
  return status === "finalizing" || status === "processing";
}

type TabItemBaseProps = {
  icon: React.ReactNode;
  title: React.ReactNode;
  selected: boolean;
  status?: TabStatus;
  accent?: TabAccent;
  pinned?: boolean;
  allowPin?: boolean;
  allowClose?: boolean;
  isEmptyTab?: boolean;
  tabIndex?: number;
  showCloseConfirmation?: boolean;
  onCloseConfirmationChange?: (show: boolean) => void;
  hoverAction?: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
  };
} & {
  handleCloseThis: () => void;
  handleSelectThis: () => void;
  handleCloseOthers: () => void;
  handleCloseAll: () => void;
  handlePinThis: () => void;
  handleUnpinThis: () => void;
};

export type TabItem<T extends Tab = Tab> = (
  props: TabItemProps<T>,
) => React.ReactNode;

export function TabItemBase({
  icon,
  title,
  selected,
  status,
  accent: accentOverride,
  pinned = false,
  allowPin = true,
  allowClose = true,
  isEmptyTab = false,
  tabIndex,
  showCloseConfirmation = false,
  onCloseConfirmationChange,
  hoverAction,
  handleCloseThis,
  handleSelectThis,
  handleCloseOthers,
  handleCloseAll,
  handlePinThis,
  handleUnpinThis,
}: TabItemBaseProps) {
  const accent = accentOverride ?? statusToAccent(status);
  const active = statusRequiresConfirmation(status);
  const showSpinner = statusShowsSpinner(status);

  const colors = accentColors[accent];
  const isCmdPressed = useCmdKeyPressed();
  const [isHovered, setIsHovered] = useState(false);
  const [localShowConfirmation, setLocalShowConfirmation] = useState(false);

  const isConfirmationOpen = showCloseConfirmation || localShowConfirmation;

  useEffect(() => {
    if (showCloseConfirmation) {
      setLocalShowConfirmation(true);
    }
  }, [showCloseConfirmation]);

  const handleCloseConfirmationChange = (open: boolean) => {
    setLocalShowConfirmation(open);
    onCloseConfirmationChange?.(open);
  };

  const handleAttemptClose = () => {
    if (active) {
      handleCloseConfirmationChange(true);
    } else {
      handleCloseThis();
    }
  };

  const handleConfirmClose = useCallback(() => {
    setLocalShowConfirmation(false);
    onCloseConfirmationChange?.(false);
    handleCloseThis();
  }, [handleCloseThis, onCloseConfirmationChange]);

  useEffect(() => {
    if (!isConfirmationOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "w") {
        e.preventDefault();
        e.stopPropagation();
        handleConfirmClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [isConfirmationOpen, handleConfirmClose]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 && !active && allowClose) {
      e.preventDefault();
      e.stopPropagation();
      handleCloseThis();
    }
  };

  const contextMenu = allowClose
    ? active || (selected && !isEmptyTab)
      ? [
          { id: "close-tab", text: "Close", action: handleAttemptClose },
          {
            id: "close-others",
            text: "Close others",
            action: handleCloseOthers,
          },
          { id: "close-all", text: "Close all", action: handleCloseAll },
          ...(allowPin
            ? [
                { separator: true as const },
                pinned
                  ? {
                      id: "unpin-tab",
                      text: "Unpin tab",
                      action: handleUnpinThis,
                    }
                  : { id: "pin-tab", text: "Pin tab", action: handlePinThis },
              ]
            : []),
        ]
      : [
          { id: "close-tab", text: "Close", action: handleAttemptClose },
          {
            id: "close-others",
            text: "Close others",
            action: handleCloseOthers,
          },
          { id: "close-all", text: "Close all", action: handleCloseAll },
          ...(allowPin
            ? [
                { separator: true as const },
                pinned
                  ? {
                      id: "unpin-tab",
                      text: "Unpin tab",
                      action: handleUnpinThis,
                    }
                  : { id: "pin-tab", text: "Pin tab", action: handlePinThis },
              ]
            : []),
        ]
    : [];

  const showShortcut = isCmdPressed && tabIndex !== undefined;
  const showHoverControls = isHovered || isConfirmationOpen;
  const actionSlotClassName = showShortcut
    ? "flex h-5 min-w-fit items-center justify-end"
    : hoverAction
      ? "h-4 w-9"
      : "h-4 w-4";

  const indicatorDot =
    status === "listening" ? (
      <div className="relative size-2">
        <div className="bg-destructive absolute inset-0 rounded-full"></div>
        <div className="bg-destructive/40 absolute inset-0 animate-ping rounded-full"></div>
      </div>
    ) : status === "listening-degraded" ? (
      <AlertCircleIcon className="text-warning size-4" />
    ) : null;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative h-8"
    >
      <InteractiveButton
        asChild
        contextMenu={contextMenu}
        onClick={handleSelectThis}
        onMouseDown={handleMouseDown}
        className={cn([
          "relative flex items-center gap-1",
          "h-8 w-[160px] px-2",
          "rounded-xl border",
          "group cursor-pointer",
          "transition-colors duration-200",
          selected ? colors.selected : colors.unselected,
        ])}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <div className="flex h-4 w-4 shrink-0 items-center justify-center">
            {showSpinner ? <Spinner size={16} /> : (indicatorDot ?? icon)}
          </div>
          <span className="pointer-events-none truncate">{title}</span>
        </div>
        <div
          className={cn([
            "relative shrink-0 overflow-visible",
            actionSlotClassName,
          ])}
        >
          <div
            className={cn([
              "absolute inset-0 flex items-center justify-center transition-opacity duration-200",
              showShortcut ||
              (showHoverControls && (allowClose || !!hoverAction))
                ? "opacity-0"
                : "opacity-100",
            ])}
          >
            {pinned && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUnpinThis();
                }}
                className={cn([
                  "flex items-center justify-center transition-colors",
                  colors.hover[selected ? "selected" : "unselected"],
                ])}
              >
                <Pin size={14} />
              </button>
            )}
          </div>
          {hoverAction && (
            <div
              className={cn([
                "absolute top-0 left-0 flex h-4 w-4 items-center justify-center transition-opacity duration-200",
                showShortcut || !showHoverControls
                  ? "pointer-events-none opacity-0"
                  : "pointer-events-auto opacity-100",
              ])}
            >
              <button
                type="button"
                aria-label={hoverAction.label}
                title={hoverAction.label}
                onClick={(e) => {
                  e.stopPropagation();
                  hoverAction.onClick();
                }}
                className={cn([
                  "flex items-center justify-center transition-colors",
                  colors.hover[selected ? "selected" : "unselected"],
                ])}
              >
                {hoverAction.icon}
              </button>
            </div>
          )}
          {allowClose && (
            <div
              className={cn([
                "absolute top-0 right-0 flex h-4 w-4 items-center justify-center transition-opacity duration-200",
                showShortcut || !showHoverControls
                  ? "pointer-events-none opacity-0"
                  : "pointer-events-auto opacity-100",
              ])}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAttemptClose();
                }}
                className={cn([
                  "flex items-center justify-center transition-colors",
                  colors.hover[selected ? "selected" : "unselected"],
                ])}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {showShortcut && (
            <div className="pointer-events-none flex h-full items-center justify-end">
              <Kbd>⌘ {tabIndex}</Kbd>
            </div>
          )}
        </div>
      </InteractiveButton>
      <Popover
        open={active && isConfirmationOpen}
        onOpenChange={handleCloseConfirmationChange}
      >
        <PopoverTrigger asChild>
          <div className="pointer-events-none absolute inset-0" />
        </PopoverTrigger>
        <PopoverContent
          variant="app"
          side="bottom"
          align="start"
          className="z-[60] w-[240px]"
          sideOffset={2}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <AppFloatingPanel className="flex flex-col gap-2 p-3">
            <p className="text-foreground text-sm">
              Are you sure you want to close this tab? This will stop Meetspace
              from listening.
            </p>
            <Button
              variant="destructive"
              className="group relative flex h-9 w-full items-center justify-center rounded-lg"
              onClick={(e) => {
                e.stopPropagation();
                handleConfirmClose();
              }}
            >
              <span>Close</span>
              <Kbd
                className={cn([
                  "absolute right-2",
                  "border-destructive/30/30 bg-destructive-bg/20 text-destructive-bg",
                  "transition-all duration-100",
                  "group-hover:-translate-y-0.5 group-hover:shadow-[0_2px_0_0_rgba(0,0,0,0.15),inset_0_1px_0_0_rgba(255,255,255,0.8)]",
                  "group-active:translate-y-0.5 group-active:shadow-none",
                ])}
              >
                ⌘ W
              </Kbd>
            </Button>
          </AppFloatingPanel>
        </PopoverContent>
      </Popover>
    </div>
  );
}
