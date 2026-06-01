import { useQueryClient } from "@tanstack/react-query";
import { platform } from "@tauri-apps/plugin-os";
import { useCallback, useEffect, useState } from "react";

import { commands as analyticsCommands } from "@meetspace/plugin-analytics";
import { cn } from "@meetspace/utils";

import { CalendarSection } from "./calendar";
import {
  getInitialStep,
  getNextStep,
  getPrevStep,
  getStepStatus,
} from "./config";
import { FinalSection, finishOnboarding } from "./final";
import { FolderLocationSection } from "./folder-location";
import { PermissionsSection } from "./permissions";
import { OnboardingSection } from "./shared";

import { StandardTabWrapper } from "~/shared/main";
import { StandaloneWindowShell } from "~/shared/window-shell";
import { type Tab, useTabs } from "~/store/zustand/tabs";

export function TabContentOnboarding({
  tab: _tab,
}: {
  tab: Extract<Tab, { type: "onboarding" }>;
}) {
  const close = useTabs((state) => state.close);
  const currentTab = useTabs((state) => state.currentTab);

  const handleFinish = useCallback(() => {
    if (currentTab) {
      close(currentTab);
    }
  }, [close, currentTab]);

  return <OnboardingScreen onFinish={handleFinish} />;
}

function OnboardingScreen({ onFinish }: { onFinish: () => void }) {
  return (
    <OnboardingScreenContent
      onFinish={onFinish}
      headerClassName="px-12 pt-12 pb-8"
    />
  );
}

export function StandaloneOnboardingScreen({
  onFinish,
}: {
  onFinish: () => void;
}) {
  const isMacOS = platform() === "macos";

  return (
    <StandaloneWindowShell>
      <OnboardingScreenContent
        onFinish={onFinish}
        headerClassName={
          isMacOS ? "pt-12 pr-12 pb-8 pl-20" : "px-12 pt-12 pb-8"
        }
        headerDragRegion
      />
    </StandaloneWindowShell>
  );
}

function OnboardingScreenContent({
  onFinish,
  headerClassName,
  headerDragRegion = false,
}: {
  onFinish: () => void;
  headerClassName: string;
  headerDragRegion?: boolean;
}) {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(getInitialStep);
  const currentPlatform = platform();

  const goNext = useCallback(() => {
    const next = getNextStep(currentStep);
    if (next) setCurrentStep(next);
  }, [currentStep]);

  const goBack = useCallback(() => {
    const prev = getPrevStep(currentStep);
    if (prev) setCurrentStep(prev);
  }, [currentStep]);

  useEffect(() => {
    void analyticsCommands.event({
      event: "onboarding_step_viewed",
      step: currentStep,
      platform: currentPlatform,
    });
  }, [currentPlatform, currentStep]);

  const handleFinish = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["onboarding-needed"] });
    onFinish();
  }, [onFinish, queryClient]);

  return (
    <StandardTabWrapper noBorder>
      <div className="relative flex h-full flex-col">
        <div
          data-tauri-drag-region={headerDragRegion || undefined}
          className={cn([
            "sticky top-0 z-10 flex items-center justify-between",
            headerClassName,
          ])}
        >
          <h1 className="text-foreground font-sans text-3xl font-semibold">
            Welcome to Meetspace
          </h1>
        </div>

        <div className="relative z-10 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4 px-12 pb-16">
            <OnboardingSection
              title="Start with permissions"
              completedTitle="Permissions granted"
              description="Meetspace needs access to your microphone and system audio to record and transcribe your meetings"
              status={getStepStatus("permissions", currentStep)}
              skippable={false}
              onBack={goBack}
              onNext={goNext}
            >
              <PermissionsSection onContinue={goNext} />
            </OnboardingSection>

            <OnboardingSection
              title="Connect calendar"
              description="Meetspace will sync your calendar to get meeting reminders"
              completedTitle="Calendar connected"
              status={getStepStatus("calendar", currentStep)}
              onBack={goBack}
              onNext={goNext}
            >
              <CalendarSection onContinue={goNext} />
            </OnboardingSection>

            <OnboardingSection
              title="Storage"
              description="Where your notes and recordings are stored"
              completedTitle="Storage configured"
              status={getStepStatus("folder-location", currentStep)}
              onBack={goBack}
              onNext={goNext}
            >
              <FolderLocationSection onContinue={goNext} />
            </OnboardingSection>

            <OnboardingSection
              title="Ready to go"
              status={getStepStatus("final", currentStep)}
              skippable={false}
              onBack={goBack}
              onNext={() => void finishOnboarding(handleFinish)}
            >
              <FinalSection onContinue={handleFinish} />
            </OnboardingSection>
          </div>
        </div>
      </div>
    </StandardTabWrapper>
  );
}
