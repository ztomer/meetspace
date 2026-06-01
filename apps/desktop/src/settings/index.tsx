import { cn } from "@meetspace/utils";

import {
  SettingsApp,
  SettingsData,
  SettingsNotifications,
  SettingsPermissions,
} from "./general";
import { SettingsIntegrations } from "./integrations";
import { SettingsTodo } from "./todo";

import { Intelligence } from "~/settings/ai";
import { StandardTabWrapper } from "~/shared/main";
import { type Tab } from "~/store/zustand/tabs";

export function TabContentSettings({
  tab,
}: {
  tab: Extract<Tab, { type: "settings" }>;
}) {
  return (
    <StandardTabWrapper>
      <SettingsView tab={tab} />
    </StandardTabWrapper>
  );
}

function SettingsView({ tab }: { tab: Extract<Tab, { type: "settings" }> }) {
  const activeTab = tab.state.tab ?? "app";

  const renderContent = () => {
    switch (activeTab) {
      case "app":
        return <SettingsApp />;
      case "data":
        return <SettingsData />;
      case "notifications":
        return <SettingsNotifications />;
      case "permissions":
        return <SettingsPermissions />;
      case "transcription":
      case "intelligence":
        return <Intelligence />;
      case "integrations":
        return <SettingsIntegrations />;
      case "todo":
        return <SettingsTodo />;
    }
  };

  return (
    <div className="flex w-full flex-1 flex-col overflow-hidden">
      <div className="relative w-full flex-1 overflow-hidden">
        <div
          className={cn([
            "scroll-fade-y scrollbar-hide h-full w-full flex-1 overflow-y-auto px-6 pt-3 pb-6",
          ])}
        >
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
