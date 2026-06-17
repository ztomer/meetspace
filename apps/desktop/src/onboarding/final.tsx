import { Icon } from "@iconify-icon/react";

import { commands as analyticsCommands } from "@meetspace/plugin-analytics";
import { commands as openerCommands } from "@meetspace/plugin-opener2";

import { OnboardingButton } from "./shared";

import { flushAutomaticRelaunch } from "~/store/tinybase/store/save";
import { commands } from "~/types/tauri.gen";

const SOCIALS = [
  {
    label: "GitHub",
    icon: "simple-icons:github",
    size: 23,
    url: "https://github.com/ztomer/meetspace",
  },
] as const;

export function FinalSection({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="items-left text-muted-foreground flex flex-col gap-4 text-sm">
        <span>Join our community and stay updated:</span>
        <div className="flex items-center gap-4">
          {SOCIALS.map(({ label, icon, size, url }) => {
            return (
              <button
                key={label}
                onClick={() => void openerCommands.openUrl(url, null)}
                className="text-muted-foreground hover:text-foreground inline-flex size-6 items-center justify-center rounded-md transition-colors duration-150"
                aria-label={label}
              >
                <Icon icon={icon} width={size} height={size} />
              </button>
            );
          })}
        </div>
      </div>

      <OnboardingButton
        className="px-10 py-3.5 text-base"
        onClick={() => void finishOnboarding(onContinue)}
      >
        Open Meetspace
      </OnboardingButton>
    </div>
  );
}

export async function finishOnboarding(onContinue?: () => void) {
  await new Promise((resolve) => setTimeout(resolve, 100));
  await commands.setOnboardingNeeded(false).catch(console.error);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await analyticsCommands.event({ event: "onboarding_completed" });
  if (await flushAutomaticRelaunch()) {
    return;
  }
  onContinue?.();
}
