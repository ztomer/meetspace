import { CalendarIcon, ExternalLinkIcon } from "lucide-react";
import { useEffect } from "react";

import { ChangelogContent } from "@meetspace/changelog";
import { commands as openerCommands } from "@meetspace/plugin-opener2";
import { Button } from "@meetspace/ui/components/ui/button";
import { safeFormat } from "@meetspace/utils";

import { useChangelogContent } from "./data";

import { useShell } from "~/contexts/shell";
import { StandardTabWrapper } from "~/shared/main";
import { type Tab } from "~/store/zustand/tabs";

export { getLatestVersion } from "./data";

export function TabContentChangelog({
  tab,
}: {
  tab: Extract<Tab, { type: "changelog" }>;
}) {
  const { current } = tab.state;
  const { leftsidebar, chat } = useShell();

  useEffect(() => {
    leftsidebar.setExpanded(false);
    if (chat.mode === "RightPanelOpen") {
      chat.sendEvent({ type: "CLOSE" });
    }
  }, []);

  const { content, date, loading } = useChangelogContent(current);

  return (
    <StandardTabWrapper>
      <div className="flex h-full flex-col">
        <div className="shrink-0 pr-1 pl-2">
          <ChangelogHeader version={current} date={date} />
        </div>

        <div className="mt-2 shrink-0 px-3">
          <h1 className="text-foreground text-xl font-semibold">
            What's new in {current}?
          </h1>
        </div>

        <div className="relative mt-4 min-h-0 flex-1 overflow-hidden">
          <div className="scroll-fade-y h-full overflow-y-auto px-3 pb-4">
            <ChangelogBody content={content} loading={loading} />
          </div>
        </div>
      </div>
    </StandardTabWrapper>
  );
}

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      className="text-info-fg hover:text-info-fg underline"
      href={href}
      onClick={(e) => {
        e.preventDefault();
        void openerCommands.openUrl(href, null);
      }}
    >
      {children}
    </a>
  );
}

function ChangelogBody({
  content,
  loading,
}: {
  content: string | null;
  loading: boolean;
}) {
  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (content) {
    return (
      <ChangelogContent
        content={content}
        components={{
          a: ({
            href,
            children,
          }: {
            href?: string;
            children?: React.ReactNode;
          }) =>
            href ? (
              <ExternalLink href={href}>{children}</ExternalLink>
            ) : (
              <>{children}</>
            ),
        }}
      />
    );
  }

  return (
    <p className="text-muted-foreground">
      No changelog available for this version.
    </p>
  );
}

function ChangelogHeader({
  version,
  date,
}: {
  version: string;
  date: string | null;
}) {
  const formattedDate = date ? safeFormat(date, "MMM d, yyyy") : null;
  const webUrl = `https://meetspace.so/changelog/${version}`;

  return (
    <div className="w-full pt-1">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="ml-1.5 flex min-w-0 items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Changelog</span>
            <span className="text-muted-foreground/30">/</span>
            <span className="text-foreground truncate font-medium">
              {version}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center">
          {formattedDate && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground pointer-events-none"
            >
              <CalendarIcon size={14} className="shrink-0" />
              <span>{formattedDate}</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground gap-1.5"
            onClick={() => openerCommands.openUrl(webUrl, null)}
          >
            <ExternalLinkIcon size={14} />
            <span>Open in web</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
