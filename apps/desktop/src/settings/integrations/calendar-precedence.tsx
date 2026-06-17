/**
 * Phase 10.4 — per-source primary-provider setting.
 *
 * When the same logical event surfaces from multiple calendar providers
 * (Apple's Google account + the Google OAuth integration directly, etc.),
 * the dedup pass in `services/calendar/dedup.ts` keeps the version from
 * whichever provider sits highest in this ordered list.
 *
 * UI is a click-to-reorder list rather than HTML5 drag-and-drop — the
 * latter is fiddly across platforms (especially Linux/Tauri) and three
 * items don't need a complex DnD interaction. Up / Down buttons per row.
 */

import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { cn } from "@meetspace/utils";

import { parsePrecedence } from "~/services/calendar/dedup";
import { useConfigValues } from "~/shared/config";
import * as settings from "~/store/tinybase/store/settings";

const PROVIDER_LABELS: Record<string, string> = {
  apple: "Apple Calendar",
  google: "Google Calendar",
  outlook: "Outlook Calendar",
};

const ALL_PROVIDERS = ["apple", "google", "outlook"] as const;

export function CalendarPrecedenceSetting() {
  const { calendar_provider_precedence } = useConfigValues([
    "calendar_provider_precedence",
  ] as const);
  const setPrecedence = settings.UI.useSetValueCallback(
    "calendar_provider_precedence",
    (next: string[]) => JSON.stringify(next),
    [],
    settings.STORE_ID,
  );

  // Merge stored order with any provider we don't know about yet so the list
  // always shows the full set in some order.
  const stored = parsePrecedence(calendar_provider_precedence);
  const order = [
    ...stored.filter((p) => ALL_PROVIDERS.includes(p as never)),
    ...ALL_PROVIDERS.filter((p) => !stored.includes(p)),
  ];

  const move = (idx: number, delta: -1 | 1) => {
    const next = [...order];
    const swap = idx + delta;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setPrecedence(next);
  };

  return (
    <section className="border-border rounded-lg border p-5">
      <h3 className="text-sm font-semibold">Calendar source precedence</h3>
      <p className="text-muted-foreground mt-1 mb-4 text-xs">
        When the same meeting comes from more than one connected calendar (e.g.
        it's in both your Apple Calendar and Google Calendar accounts),
        Meetspace shows the copy from the higher-ranked provider here. Drag the
        most trusted source to the top.
      </p>
      <ol className="flex flex-col gap-1">
        {order.map((provider, idx) => (
          <li
            key={provider}
            className={cn([
              "border-border bg-card flex items-center gap-2 rounded-md border px-3 py-2",
              "text-sm",
            ])}
          >
            <span className="text-muted-foreground w-5 text-xs tabular-nums">
              {idx + 1}.
            </span>
            <span className="flex-1">
              {PROVIDER_LABELS[provider] ?? provider}
            </span>
            <button
              type="button"
              aria-label={`Move ${provider} up`}
              onClick={() => move(idx, -1)}
              disabled={idx === 0}
              className={cn([
                "text-muted-foreground hover:text-foreground rounded p-1",
                "disabled:hover:text-muted-foreground disabled:opacity-30",
              ])}
            >
              <ChevronUpIcon size={14} />
            </button>
            <button
              type="button"
              aria-label={`Move ${provider} down`}
              onClick={() => move(idx, 1)}
              disabled={idx === order.length - 1}
              className={cn([
                "text-muted-foreground hover:text-foreground rounded p-1",
                "disabled:hover:text-muted-foreground disabled:opacity-30",
              ])}
            >
              <ChevronDownIcon size={14} />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
