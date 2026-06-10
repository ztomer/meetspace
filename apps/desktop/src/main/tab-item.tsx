import { MainTabItem } from "~/shared/main/tab-item";
import { type Tab } from "~/store/zustand/tabs";

export function ClassicMainTabItem({
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
  return (
    <MainTabItem
      tab={tab}
      handleClose={handleClose}
      handleSelect={handleSelect}
      handleCloseOthersCallback={handleCloseOthersCallback}
      handleCloseAll={handleCloseAll}
      handlePin={handlePin}
      handleUnpin={handleUnpin}
      tabIndex={tabIndex}
      pendingCloseConfirmationTab={pendingCloseConfirmationTab}
      setPendingCloseConfirmationTab={setPendingCloseConfirmationTab}
    />
  );
}
