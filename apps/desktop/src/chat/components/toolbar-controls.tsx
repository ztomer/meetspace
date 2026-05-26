import { ChevronDown, MessageCircle, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@meetspace/ui/components/ui/button";
import {
  AppFloatingPanel,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@meetspace/ui/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@meetspace/ui/components/ui/tooltip";
import { cn, formatDistanceToNow } from "@meetspace/utils";

import * as main from "~/store/tinybase/store/main";

export function ChatToolbarControls({
  currentChatGroupId,
  onCloseChat,
  onNewChat,
  onSelectChat,
  shortcutLabel,
}: {
  currentChatGroupId: string | undefined;
  onCloseChat: () => void;
  onNewChat: () => void;
  onSelectChat: (chatGroupId: string) => void;
  shortcutLabel?: string;
}) {
  return (
    <div className="relative flex h-full w-full min-w-0 items-center">
      <div className="flex min-w-0 items-center gap-1 pr-8">
        <ChatGroups
          currentChatGroupId={currentChatGroupId}
          onSelectChat={onSelectChat}
        />
        <ChatActionButton
          icon={<Plus size={16} />}
          onClick={onNewChat}
          title="New chat"
        />
      </div>
      <ChatActionButton
        icon={<MessageCircle size={16} />}
        onClick={onCloseChat}
        title="Close chat"
        shortcutLabel={shortcutLabel}
        className="bg-muted text-foreground hover:bg-muted absolute top-1/2 right-0 -translate-y-1/2"
      />
    </div>
  );
}

function ChatActionButton({
  className,
  icon,
  title,
  onClick,
  shortcutLabel,
}: {
  className?: string;
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  shortcutLabel?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={onClick}
          title={title}
          size="icon"
          variant="ghost"
          className={cn(["text-muted-foreground", className])}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="flex items-center gap-2">
        <span>{title}</span>
        {shortcutLabel && (
          <span className="border-border bg-muted text-muted-foreground rounded border px-1 py-0.5 text-[10px]">
            {shortcutLabel}
          </span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function ChatGroups({
  currentChatGroupId,
  onSelectChat,
}: {
  currentChatGroupId: string | undefined;
  onSelectChat: (chatGroupId: string) => void;
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const currentChatTitle = main.UI.useCell(
    "chat_groups",
    currentChatGroupId || "",
    "title",
    main.STORE_ID,
  );
  const recentChatGroupIds = main.UI.useSortedRowIds(
    "chat_groups",
    "created_at",
    true,
    0,
    5,
    main.STORE_ID,
  );

  return (
    <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn([
            "group flex h-8 max-w-64 min-w-0 justify-start gap-2 px-0 py-0",
            "text-foreground",
          ])}
        >
          <h3 className="text-foreground min-w-0 flex-1 truncate text-xs font-medium">
            {currentChatTitle || "Ask Meetspace AI anything"}
          </h3>
          <ChevronDown
            className={cn([
              "text-muted-foreground h-3.5 w-3.5 shrink-0 transition-transform duration-200",
              isDropdownOpen && "rotate-180",
            ])}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        variant="app"
        align="start"
        sideOffset={0}
        className="w-72"
      >
        <AppFloatingPanel className="flex flex-col gap-0.5 p-1.5">
          <div className="px-2 py-1.5">
            <h4 className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Recent Chats
            </h4>
          </div>
          {recentChatGroupIds.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {recentChatGroupIds.map((groupId) => (
                <ChatGroupItem
                  key={groupId}
                  groupId={groupId}
                  isActive={groupId === currentChatGroupId}
                  onSelect={(id) => {
                    onSelectChat(id);
                    setIsDropdownOpen(false);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="px-3 py-6 text-center">
              <MessageCircle className="text-muted-foreground/60 mx-auto mb-1.5 h-6 w-6" />
              <p className="text-muted-foreground text-xs">No recent chats</p>
            </div>
          )}
        </AppFloatingPanel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ChatGroupItem({
  groupId,
  isActive,
  onSelect,
}: {
  groupId: string;
  isActive: boolean;
  onSelect: (groupId: string) => void;
}) {
  const chatGroup = main.UI.useRow("chat_groups", groupId, main.STORE_ID);

  if (!chatGroup) {
    return null;
  }

  const formattedTime = chatGroup.created_at
    ? formatDistanceToNow(new Date(chatGroup.created_at), {
        addSuffix: true,
      })
    : "";

  return (
    <Button
      variant="ghost"
      onClick={() => onSelect(groupId)}
      className={cn([
        "group h-auto w-full justify-start px-2.5 py-1.5",
        isActive
          ? "bg-muted hover:bg-muted shadow-xs"
          : "hover:bg-muted active:bg-muted",
      ])}
    >
      <div className="flex w-full items-center gap-2.5">
        <div className="shrink-0">
          <MessageCircle
            className={cn([
              "h-3.5 w-3.5 transition-colors",
              isActive
                ? "text-foreground"
                : "text-muted-foreground group-hover:text-muted-foreground",
            ])}
          />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <div
            className={cn([
              "truncate text-sm font-medium",
              isActive ? "text-foreground" : "text-foreground",
            ])}
          >
            {chatGroup.title}
          </div>
          <div className="text-muted-foreground mt-0.5 text-[11px]">
            {formattedTime}
          </div>
        </div>
      </div>
    </Button>
  );
}
