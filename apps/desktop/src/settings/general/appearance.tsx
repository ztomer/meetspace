import { MoonIcon, MonitorIcon, SunIcon } from "lucide-react";

import { cn } from "@meetspace/utils";

import { useConfigValue } from "~/shared/config";
import { useSetSettingValue } from "~/settings/queries";
import type { ThemeChoice } from "~/shared/theme";

const OPTIONS: Array<{
  value: ThemeChoice;
  label: string;
  icon: typeof SunIcon;
}> = [
  { value: "system", label: "System", icon: MonitorIcon },
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
];

export function AppearanceSettings() {
  const theme = (useConfigValue("theme") ?? "system") as ThemeChoice;
  const setTheme = useSetSettingValue("theme");

  return (
    <div>
      <h2 className="mb-4 font-sans text-lg font-semibold">Appearance</h2>
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">
          Choose how Meetspace looks. System follows your OS preference.
        </p>
        <div className="border-border bg-card inline-flex w-fit rounded-lg border p-1">
          {OPTIONS.map(({ value, label, icon: Icon }) => {
            const selected = theme === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={cn([
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5",
                  "text-xs font-medium transition-colors",
                  selected
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                ])}
                aria-pressed={selected}
              >
                <Icon size={14} />
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
