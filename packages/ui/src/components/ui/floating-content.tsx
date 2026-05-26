import { cn } from "@meetspace/utils";

export const appFloatingContentClassName =
  "overflow-hidden rounded-2xl border border-border bg-popover p-1 shadow-lg";

export type FloatingContentVariant = "default" | "app";

export function AppFloatingPanel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn([
        "rounded-xl border border-border bg-popover",
        className,
      ])}
      {...props}
    />
  );
}
