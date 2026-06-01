import { ClassicMainBody } from "./body";

import { useShell } from "~/contexts/shell";
import { useConfigValue } from "~/shared/config";
import { MainShellBodyFrame, MainShellScaffold } from "~/shared/main";
import { ToastArea } from "~/sidebar/toast";
import { hasCustomSidebarTab } from "~/sidebar/use-custom-sidebar";
import { useTabs } from "~/store/zustand/tabs";

export function ClassicMainShellFrame() {
  const { leftsidebar } = useShell();
  const currentTab = useTabs((state) => state.currentTab);
  const sidebarTimelineEnabled = useConfigValue("sidebar_timeline_enabled");

  const isOnboarding = currentTab?.type === "onboarding";
  const hasCustomSidebar = hasCustomSidebarTab(currentTab);
  const showSidebarTimelineChrome =
    sidebarTimelineEnabled && !hasCustomSidebar && !isOnboarding;
  const showSidebarTimeline = showSidebarTimelineChrome && leftsidebar.expanded;

  return (
    <MainShellScaffold>
      <MainShellBodyFrame>
        <ClassicMainBody />
      </MainShellBodyFrame>
      <ToastArea placement={showSidebarTimeline ? "left-sidebar" : "default"} />
    </MainShellScaffold>
  );
}
