import { cn } from "@meetspace/utils";

export function TranscriptSeparator() {
  return (
    <div
      className={cn([
        "flex items-center gap-3",
        "text-xs font-light text-muted-foreground",
      ])}
    >
      <div className="flex-1 border-t border-border/40" />
      <span>~ ~ ~ ~ ~ ~ ~ ~ ~</span>
      <div className="flex-1 border-t border-border/40" />
    </div>
  );
}
