import {
  BookTextIcon,
  CalendarIcon,
  CogIcon,
  PictureInPicture2Icon,
  SparklesIcon,
  StickyNoteIcon,
  UserIcon,
} from "lucide-react";
import { useCallback } from "react";

import { TabItemEdit } from "~/edit";
import { openFloatingMeetingPanel } from "~/meeting-float/host";
import { TabItemOnboarding } from "~/onboarding";
import { useIsSessionEnhancing } from "~/session/hooks/useEnhancedNotes";
import { useSession } from "~/session/queries";
import { getSessionTabStatus } from "~/session/tab-visual-state";
import { useConfigValue } from "~/shared/config";
import { type TabItem, TabItemBase } from "~/shared/tabs";
import { useSessionTitle } from "~/store/zustand/live-title";
import { type Tab } from "~/store/zustand/tabs";
import { useListener } from "~/stt/contexts";
import { TabItemTask } from "~/task";

export const TabItemChangelog: TabItem<Extract<Tab, { type: "changelog" }>> = ({
  tab,
  tabIndex,
  handleCloseThis,
  handleSelectThis,
  handleCloseOthers,
  handleCloseAll,
  handlePinThis,
  handleUnpinThis,
}) => (
  <TabItemBase
    icon={<SparklesIcon className="h-4 w-4" />}
    title="What's New"
    selected={tab.active}
    pinned={tab.pinned}
    tabIndex={tabIndex}
    handleCloseThis={() => handleCloseThis(tab)}
    handleSelectThis={() => handleSelectThis(tab)}
    handleCloseOthers={handleCloseOthers}
    handleCloseAll={handleCloseAll}
    handlePinThis={() => handlePinThis(tab)}
    handleUnpinThis={() => handleUnpinThis(tab)}
  />
);

export const TabItemHuman: TabItem<Extract<Tab, { type: "humans" }>> = ({
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
      icon={<UserIcon className="h-4 w-4" />}
      title={"Human"}
      selected={tab.active}
      pinned={tab.pinned}
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

export const TabItemNote: TabItem<Extract<Tab, { type: "sessions" }>> = ({
  tab,
  tabIndex,
  handleCloseThis,
  handleSelectThis,
  handleCloseOthers,
  handleCloseAll,
  handlePinThis,
  handleUnpinThis,
  pendingCloseConfirmationTab,
  setPendingCloseConfirmationTab,
}) => {
  const session = useSession(tab.id);
  const title = useSessionTitle(tab.id, session?.title);
  const sessionMode = useListener((state) => state.getSessionMode(tab.id));
  const stop = useListener((state) => state.stop);
  const degraded = useListener((state) => state.live.degraded);
  const floatingBarEnabled = useConfigValue("floating_bar_enabled");
  const isEnhancing = useIsSessionEnhancing(tab.id);
  const status = getSessionTabStatus(
    sessionMode,
    isEnhancing,
    !!degraded,
    tab.active,
  );
  const isActive =
    status === "listening" ||
    status === "listening-degraded" ||
    status === "finalizing";

  const showCloseConfirmation =
    pendingCloseConfirmationTab?.type === "sessions" &&
    pendingCloseConfirmationTab?.id === tab.id;

  const handleCloseConfirmationChange = (show: boolean) => {
    if (!show) {
      setPendingCloseConfirmationTab?.(null);
    }
  };

  const handleCloseWithStop = useCallback(() => {
    if (isActive) {
      stop();
    }
    handleCloseThis(tab);
  }, [isActive, stop, tab, handleCloseThis]);

  const handleOpenFloatingPanel = useCallback(() => {
    void openFloatingMeetingPanel({
      sessionId: tab.id,
      enabled: floatingBarEnabled,
    });
  }, [floatingBarEnabled, tab.id]);

  return (
    <TabItemBase
      icon={<StickyNoteIcon className="h-4 w-4" />}
      title={title || "Untitled"}
      selected={tab.active}
      status={status}
      pinned={tab.pinned}
      tabIndex={tabIndex}
      hoverAction={
        isActive && floatingBarEnabled
          ? {
              icon: <PictureInPicture2Icon size={14} />,
              label: "Open floating panel",
              onClick: handleOpenFloatingPanel,
            }
          : undefined
      }
      showCloseConfirmation={showCloseConfirmation}
      onCloseConfirmationChange={handleCloseConfirmationChange}
      handleCloseThis={handleCloseWithStop}
      handleSelectThis={() => handleSelectThis(tab)}
      handleCloseOthers={handleCloseOthers}
      handleCloseAll={handleCloseAll}
      handlePinThis={() => handlePinThis(tab)}
      handleUnpinThis={() => handleUnpinThis(tab)}
    />
  );
};

export function MainTabItem({
  tab,
  handleClose,
  handleSelect,
  handleCloseOthersCallback,
  handleCloseAll,
  handlePin,
  handleUnpin,
  tabIndex,
  pendingCloseConfirmationTab,
  setPendingCloseConfirmationTab,
}: {
  tab: Tab;
  handleClose: (tab: Tab) => void;
  handleSelect: (tab: Tab) => void;
  handleCloseOthersCallback: (tab: Tab) => void;
  handleCloseAll: () => void;
  handlePin: (tab: Tab) => void;
  handleUnpin: (tab: Tab) => void;
  tabIndex?: number;
  pendingCloseConfirmationTab?: Tab | null;
  setPendingCloseConfirmationTab?: (tab: Tab | null) => void;
}) {
  const handleCloseOthers = () => handleCloseOthersCallback(tab);
  const handlePinThis = () => handlePin(tab);
  const handleUnpinThis = () => handleUnpin(tab);

  if (tab.type === "sessions") {
    return (
      <TabItemNote
        tab={tab}
        tabIndex={tabIndex}
        handleCloseThis={handleClose}
        handleSelectThis={handleSelect}
        handleCloseOthers={handleCloseOthers}
        handleCloseAll={handleCloseAll}
        handlePinThis={handlePinThis}
        handleUnpinThis={handleUnpinThis}
        pendingCloseConfirmationTab={pendingCloseConfirmationTab}
        setPendingCloseConfirmationTab={setPendingCloseConfirmationTab}
      />
    );
  }
  if (tab.type === "humans") {
    return (
      <TabItemHuman
        tab={tab}
        tabIndex={tabIndex}
        handleCloseThis={handleClose}
        handleSelectThis={handleSelect}
        handleCloseOthers={handleCloseOthers}
        handleCloseAll={handleCloseAll}
        handlePinThis={handlePinThis}
        handleUnpinThis={handleUnpinThis}
      />
    );
  }
  if (tab.type === "contacts") {
    return (
      <TabItemBase
        icon={<UserIcon className="h-4 w-4" />}
        title={"Contacts"}
        selected={tab.active}
        pinned={tab.pinned}
        tabIndex={tabIndex}
        handleCloseThis={() => handleClose(tab)}
        handleSelectThis={() => handleSelect(tab)}
        handleCloseOthers={handleCloseOthers}
        handleCloseAll={handleCloseAll}
        handlePinThis={handlePinThis}
        handleUnpinThis={handleUnpinThis}
      />
    );
  }
  if (tab.type === "calendar") {
    return (
      <TabItemBase
        icon={<CalendarIcon className="h-4 w-4" />}
        title={"Calendar"}
        selected={tab.active}
        pinned={tab.pinned}
        tabIndex={tabIndex}
        handleCloseThis={() => handleClose(tab)}
        handleSelectThis={() => handleSelect(tab)}
        handleCloseOthers={handleCloseOthers}
        handleCloseAll={handleCloseAll}
        handlePinThis={handlePinThis}
        handleUnpinThis={handleUnpinThis}
      />
    );
  }
  if (tab.type === "changelog") {
    return (
      <TabItemChangelog
        tab={tab}
        tabIndex={tabIndex}
        handleCloseThis={handleClose}
        handleSelectThis={handleSelect}
        handleCloseOthers={handleCloseOthers}
        handleCloseAll={handleCloseAll}
        handlePinThis={handlePinThis}
        handleUnpinThis={handleUnpinThis}
      />
    );
  }
  if (tab.type === "settings") {
    return (
      <TabItemBase
        icon={<CogIcon className="h-4 w-4" />}
        title={"Settings"}
        selected={tab.active}
        pinned={tab.pinned}
        tabIndex={tabIndex}
        handleCloseThis={() => handleClose(tab)}
        handleSelectThis={() => handleSelect(tab)}
        handleCloseOthers={handleCloseOthers}
        handleCloseAll={handleCloseAll}
        handlePinThis={handlePinThis}
        handleUnpinThis={handleUnpinThis}
      />
    );
  }
  if (tab.type === "templates") {
    return (
      <TabItemBase
        icon={<BookTextIcon className="h-4 w-4" />}
        title={"Templates"}
        selected={tab.active}
        pinned={tab.pinned}
        tabIndex={tabIndex}
        handleCloseThis={() => handleClose(tab)}
        handleSelectThis={() => handleSelect(tab)}
        handleCloseOthers={handleCloseOthers}
        handleCloseAll={handleCloseAll}
        handlePinThis={handlePinThis}
        handleUnpinThis={handleUnpinThis}
      />
    );
  }
  if (tab.type === "onboarding") {
    return (
      <TabItemOnboarding
        tab={tab}
        tabIndex={tabIndex}
        handleCloseThis={handleClose}
        handleSelectThis={handleSelect}
        handleCloseOthers={handleCloseOthers}
        handleCloseAll={handleCloseAll}
        handlePinThis={handlePinThis}
        handleUnpinThis={handleUnpinThis}
      />
    );
  }
  if (tab.type === "edit") {
    return (
      <TabItemEdit
        tab={tab}
        tabIndex={tabIndex}
        handleCloseThis={handleClose}
        handleSelectThis={handleSelect}
        handleCloseOthers={handleCloseOthers}
        handleCloseAll={handleCloseAll}
        handlePinThis={handlePinThis}
        handleUnpinThis={handleUnpinThis}
      />
    );
  }
  if (tab.type === "task") {
    return (
      <TabItemTask
        tab={tab}
        tabIndex={tabIndex}
        handleCloseThis={handleClose}
        handleSelectThis={handleSelect}
        handleCloseOthers={handleCloseOthers}
        handleCloseAll={handleCloseAll}
        handlePinThis={handlePinThis}
        handleUnpinThis={handleUnpinThis}
      />
    );
  }
  return null;
}
