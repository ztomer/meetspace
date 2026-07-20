import { useQueryClient } from "@tanstack/react-query";
import { platform } from "@tauri-apps/plugin-os";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

import { commands as analyticsCommands } from "@meetspace/plugin-analytics";

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

import { StandardContentWrapper } from "~/shared/main";
import { type TabItem, TabItemBase } from "~/shared/tabs";
import { StandaloneWindowShell } from "~/shared/window-shell";
import { type Tab, useTabs } from "~/store/zustand/tabs";

export const TabItemOnboarding: TabItem<
  Extract<Tab, { type: "onboarding" }>
> = ({
  tab,
  tabIndex,
  handleCloseThis,
  handleSelectThis,
  handleCloseOthers,
  handleCloseAll,
  handlePinThis,
  handleUnpinThis,
}) => {
  return (
    <TabItemBase
      icon={
        <span className="group-hover:animate-wiggle inline-block origin-[70%_80%] text-sm">
          👋
        </span>
      }
      title="Welcome"
      selected={tab.active}
      allowPin={false}
      allowClose={false}
      tabIndex={tabIndex}
      handleCloseThis={() => handleCloseThis(tab)}
      handleSelectThis={() => handleSelectThis(tab)}
      handleCloseOthers={handleCloseOthers}
      handleCloseAll={handleCloseAll}
      handlePinThis={() => handlePinThis(tab)}
      handleUnpinThis={() => handleUnpinThis(tab)}
    />
  );
};

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
  onFinish: (sessionId?: string) => void;
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
  headerClassName: _headerClassName,
  headerDragRegion: _headerDragRegion = false,
}: {
  onFinish: (sessionId?: string) => void;
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

  const handleFinish = useCallback(
    (sessionId?: string) => {
      void queryClient.invalidateQueries({ queryKey: ["onboarding-needed"] });
      onFinish(sessionId);
    },
    [onFinish, queryClient],
  );

  return (
    <StandardContentWrapper noBorder>
      <div className="bg-card relative flex h-full min-h-0 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 2, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
          >
            <h1 className="text-foreground font-sans text-3xl font-semibold">
              Welcome to Meetspace
            </h1>
          </motion.div>

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
      </div>
    </StandardContentWrapper>
  );
}
