import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  Loader2Icon,
  ShieldAlertIcon,
  XCircleIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Streamdown } from "streamdown";

import { cn } from "@meetspace/utils";

import { extractMcpOutputText } from "~/chat/mcp/mcp-output-parser";
import { useElicitation } from "~/contexts/elicitation";

export function ToolCard({
  failed,
  children,
}: {
  failed?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn([
        "my-2.5 overflow-hidden rounded-xl border shadow-sm",
        failed ? "border-destructive/30" : "border-border/80",
      ])}
    >
      {children}
    </div>
  );
}

export function ToolCardHeader({
  icon,
  running,
  awaitingApproval,
  failed,
  done,
  label,
}: {
  icon: ReactNode;
  running: boolean;
  awaitingApproval?: boolean;
  failed: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <div
      className={cn([
        "flex items-center gap-2.5 px-3.5 py-2 text-[13px]",
        failed
          ? "bg-destructive-bg text-destructive"
          : awaitingApproval
            ? "bg-muted text-foreground"
            : "bg-muted/80 text-muted-foreground",
      ])}
    >
      {running && !awaitingApproval ? (
        <Loader2Icon className="h-4 w-4 animate-spin" />
      ) : awaitingApproval ? (
        <ShieldAlertIcon className="text-muted-foreground h-4 w-4" />
      ) : (
        <span
          className={cn([
            "shrink-0 [&>svg]:h-4 [&>svg]:w-4",
            failed
              ? "text-destructive"
              : done
                ? "text-emerald-500"
                : "text-muted-foreground",
          ])}
        >
          {icon}
        </span>
      )}
      <span className="font-medium">{label}</span>
    </div>
  );
}

export function ToolCardBody({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2.5 px-3.5 py-2.5">{children}</div>;
}

export function ToolCardFooterSuccess({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 border-t border-emerald-200 bg-emerald-50 px-3.5 py-2.5 transition-colors hover:bg-emerald-100/80"
    >
      <CheckCircle2Icon className="h-4 w-4 shrink-0 text-emerald-600" />
      <span className="text-[13px] font-medium text-emerald-700">{label}</span>
      <ExternalLinkIcon className="ml-auto h-3.5 w-3.5 shrink-0 text-emerald-500" />
    </a>
  );
}

export function ToolCardFooterError({ text }: { text: string }) {
  return (
    <div className="border-destructive/30 bg-destructive-bg flex items-center gap-2 border-t px-3.5 py-2.5">
      <XCircleIcon className="text-destructive h-4 w-4 shrink-0" />
      <p className="text-destructive text-[13px]">{text}</p>
    </div>
  );
}

export function ToolCardFooterRaw({ text }: { text: string }) {
  return (
    <div className="border-border/80 bg-muted/80 border-t px-3.5 py-2.5">
      <p className="text-muted-foreground text-[13px] whitespace-pre-wrap">
        {text}
      </p>
    </div>
  );
}

export function useToolState(part: { state: string }) {
  const running =
    part.state === "input-streaming" || part.state === "input-available";
  const failed = part.state === "output-error";
  const done = part.state === "output-available";
  return { running, failed, done };
}

export function useMcpOutput<T>(
  done: boolean,
  output: unknown,
  parseFn: (output: unknown) => T | null,
): { parsed: T | null; rawText: string | null } {
  const parsed = done ? parseFn(output) : null;
  const rawText = done && !parsed ? extractMcpOutputText(output) : null;
  return { parsed, rawText };
}

export function ToolCardFooters({
  failed,
  errorText,
  rawText,
  children,
}: {
  failed: boolean;
  errorText?: unknown;
  rawText: string | null;
  children?: ReactNode;
}) {
  return (
    <>
      {children}
      {failed ? (
        <ToolCardFooterError text={String(errorText ?? "Unknown error")} />
      ) : null}
      {rawText ? <ToolCardFooterRaw text={rawText} /> : null}
    </>
  );
}

export function ToolCardApproval() {
  const { pending, respond } = useElicitation();

  if (!pending || !respond) {
    return null;
  }

  return (
    <div className="border-border/80 bg-muted/80 flex items-center gap-2.5 border-t px-3.5 py-2.5">
      <span className="text-muted-foreground flex-1 text-[13px]">
        {pending.message}
      </span>
      <button
        className="border-border bg-background text-muted-foreground hover:bg-muted rounded-md border px-3 py-1 text-[13px] transition-colors"
        onClick={() => respond(false)}
      >
        Decline
      </button>
      <button
        className="bg-primary hover:bg-primary rounded-md px-3 py-1 text-[13px] text-white transition-colors"
        onClick={() => respond(true)}
        autoFocus
      >
        Approve
      </button>
    </div>
  );
}

export function useToolApproval(running: boolean) {
  const { pending } = useElicitation();
  return running && !!pending;
}

export function MarkdownPreview({ children }: { children: string }) {
  return (
    <div className="border-border/80 bg-background rounded-lg border">
      <div className="max-h-64 overflow-y-auto px-3 py-2.5">
        <Streamdown
          className="text-foreground text-[13px] leading-relaxed"
          linkSafety={{ enabled: false }}
        >
          {children}
        </Streamdown>
      </div>
    </div>
  );
}
