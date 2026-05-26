import { clsx } from "clsx";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CheckCheck,
  MessageSquare,
} from "lucide-react";

import { Button } from "@meetspace/ui/components/ui/button";
import { cn } from "@meetspace/utils";

import { MenuItem } from "./shared";

export function NotificationsMenuHeader({ onClick }: { onClick: () => void }) {
  return (
    <MenuItem
      icon={Bell}
      label="Notifications"
      onClick={onClick}
      suffixIcon={ArrowRight}
    />
  );
}

interface Notification {
  id: string;
  type: "info" | "success" | "message";
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "3",
    type: "info",
    title: "Calendar reminder",
    description: "Team standup in 30 minutes",
    timestamp: "3 hours ago",
    read: true,
  },
];

export function NotificationsMenuContent({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-full flex-col px-2">
      <div className="flex w-full items-center gap-1 text-sm font-medium">
        <Button
          size="icon"
          variant="ghost"
          onClick={onBack}
          className="shrink-0"
        >
          <ArrowLeft size={16} />
        </Button>
        Notifications
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {MOCK_NOTIFICATIONS.map((notification) => (
          <NotificationItem key={notification.id} notification={notification} />
        ))}

        {MOCK_NOTIFICATIONS.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Bell className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">No notifications</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationItem({ notification }: { notification: Notification }) {
  const getIcon = () => {
    switch (notification.type) {
      case "message":
        return MessageSquare;
      case "success":
        return CheckCheck;
      default:
        return Bell;
    }
  };

  const Icon = getIcon();

  return (
    <button
      className={cn([
        "flex w-full gap-3 rounded-lg",
        "px-4 py-2.5",
        "text-left",
        "transition-colors hover:bg-muted",
        !notification.read && "bg-info-bg/50",
      ])}
    >
      <div
        className={cn([
          "h-8 w-8 shrink-0 rounded-full",
          "flex items-center justify-center",
          notification.type === "message" && "bg-purple-100",
          notification.type === "success" && "bg-success-bg",
          notification.type === "info" && "bg-info-bg",
        ])}
      >
        <Icon
          className={cn([
            "h-4 w-4",
            notification.type === "message" && "text-purple-600",
            notification.type === "success" && "text-success-fg",
            notification.type === "info" && "text-info-fg",
          ])}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-start justify-between gap-2">
          <p
            className={clsx(
              "truncate text-sm font-medium text-foreground",
              !notification.read && "font-semibold",
            )}
          >
            {notification.title}
          </p>
          {!notification.read && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-info" />
          )}
        </div>
        <p className="mb-1 line-clamp-2 text-xs text-muted-foreground">
          {notification.description}
        </p>
        <p className="text-xs text-muted-foreground">{notification.timestamp}</p>
      </div>
    </button>
  );
}
