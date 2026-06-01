import { MainChatPanels } from "./chat-panels";
import {
  MainSessionStatusBannerHost,
  SessionStatusBannerProvider,
} from "./session-status-banner";

import { useShell } from "~/contexts/shell";

export function MainShellBodyFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  const { chat } = useShell();
  const isRightPanelOpen = chat.mode === "RightPanelOpen";

  return (
    <SessionStatusBannerProvider>
      <MainChatPanels
        autoSaveId="main-chat-panels"
        isRightPanelOpen={isRightPanelOpen}
      >
        {children}
      </MainChatPanels>
      <MainSessionStatusBannerHost />
    </SessionStatusBannerProvider>
  );
}
