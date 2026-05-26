import { invoke } from "@tauri-apps/api/core";
import { platform } from "@tauri-apps/plugin-os";
import { ImageIcon, LinkIcon, X } from "lucide-react";
import { useCallback, useMemo } from "react";

import { commands as openerCommands } from "@meetspace/plugin-opener2";
import { sonnerToast } from "@meetspace/ui/components/ui/toast";
import { formatDistanceToNow } from "@meetspace/utils";

import { useNativeContextMenu } from "~/shared/hooks/useNativeContextMenu";

export type ImageAttachment = {
  attachmentId: string;
  type: "image";
  url: string;
  path: string;
  title: string;
  thumbnailUrl?: string;
  addedAt: string;
  isPersisted?: boolean;
};

export type LinkAttachment = {
  attachmentId: string;
  type: "link";
  url: string;
  title: string;
  addedAt: string;
  isPersisted?: boolean;
};

export type Attachment = ImageAttachment | LinkAttachment;

const REVEAL_IMAGE_LABEL =
  platform() === "macos" ? "Reveal in Finder" : "Reveal in File Manager";

function AttachmentCard({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove?: (attachmentId: string) => void;
}) {
  if (attachment.type === "link") {
    return <LinkAttachmentCard attachment={attachment} onRemove={onRemove} />;
  }

  return <ImageAttachmentCard attachment={attachment} onRemove={onRemove} />;
}

function LinkAttachmentCard({
  attachment,
  onRemove,
}: {
  attachment: LinkAttachment;
  onRemove?: (attachmentId: string) => void;
}) {
  const addedLabel = formatAttachmentTimestamp(attachment.addedAt);

  return (
    <div className="border-border bg-background hover:bg-muted relative flex flex-col gap-3 rounded-lg border p-4 transition-colors">
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(attachment.attachmentId)}
          className="border-border bg-background/80 hover:bg-background absolute top-2 right-2 rounded-full border p-1 transition-colors"
          aria-label="Remove attachment"
        >
          <X className="text-muted-foreground h-3 w-3" />
        </button>
      )}
      <div className="flex items-center gap-3">
        <div className="bg-muted flex h-12 w-12 items-center justify-center rounded">
          <LinkIcon className="text-muted-foreground h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-foreground truncate text-sm font-medium">
            {attachment.title}
          </div>
          <div className="text-muted-foreground mt-0.5 text-xs">
            {addedLabel}
          </div>
        </div>
      </div>
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-info-fg hover:text-info-fg truncate text-xs underline"
      >
        {attachment.url}
      </a>
    </div>
  );
}

function ImageAttachmentCard({
  attachment,
  onRemove,
}: {
  attachment: ImageAttachment;
  onRemove?: (attachmentId: string) => void;
}) {
  const addedLabel = formatAttachmentTimestamp(attachment.addedAt);

  const handleCopyImage = useCallback(async () => {
    try {
      await invoke("plugin:clipboard-manager|write_image", {
        image: attachment.path,
      });
      sonnerToast.success("Image copied to clipboard");
    } catch (error) {
      console.error("Failed to copy image to clipboard", error);
      sonnerToast.error("Failed to copy image");
    }
  }, [attachment.path]);

  const handleRevealImage = useCallback(() => {
    void openerCommands.revealItemInDir(attachment.path);
  }, [attachment.path]);

  const contextMenu = useMemo(
    () => [
      {
        id: `copy-image-${attachment.attachmentId}`,
        text: "Copy Image",
        action: () => {
          void handleCopyImage();
        },
      },
      {
        id: `reveal-image-${attachment.attachmentId}`,
        text: REVEAL_IMAGE_LABEL,
        action: handleRevealImage,
      },
    ],
    [attachment.attachmentId, handleCopyImage, handleRevealImage],
  );

  const showContextMenu = useNativeContextMenu(contextMenu);

  return (
    <div
      onContextMenu={showContextMenu}
      className="border-border bg-background hover:bg-muted relative flex flex-col gap-3 rounded-lg border p-4 transition-colors"
    >
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(attachment.attachmentId)}
          className="border-border bg-background/80 hover:bg-background absolute top-2 right-2 z-10 rounded-full border p-1 transition-colors"
          aria-label="Remove attachment"
        >
          <X className="text-muted-foreground h-3 w-3" />
        </button>
      )}
      <div className="bg-muted relative aspect-video w-full overflow-hidden rounded">
        {attachment.thumbnailUrl ? (
          <img
            src={attachment.thumbnailUrl}
            alt={attachment.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="text-muted-foreground h-8 w-8" />
          </div>
        )}
        {!attachment.isPersisted && (
          <div className="bg-background/60 absolute inset-0 flex items-center justify-center">
            <span className="text-muted-foreground text-xs font-medium">
              Saving...
            </span>
          </div>
        )}
      </div>
      <div>
        <div className="text-foreground text-sm font-medium">
          {attachment.title}
        </div>
        <div className="text-muted-foreground mt-0.5 text-xs">{addedLabel}</div>
      </div>
    </div>
  );
}

export function Attachments({
  attachments,
  onRemoveAttachment,
  isLoading = false,
}: {
  attachments: Attachment[];
  onRemoveAttachment?: (attachmentId: string) => void;
  isLoading?: boolean;
}) {
  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="min-h-0 flex-1">
        {isLoading ? (
          <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
            Loading attachments...
          </div>
        ) : attachments.length === 0 ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 text-center text-xs">
            <ImageIcon className="text-muted-foreground h-5 w-5" />
            <p>No attachments yet. Use the + icon above to add one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 pb-4 md:grid-cols-2 lg:grid-cols-3">
            {attachments.map((attachment) => (
              <AttachmentCard
                key={attachment.attachmentId}
                attachment={attachment}
                onRemove={onRemoveAttachment}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatAttachmentTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return formatDistanceToNow(date, { addSuffix: true });
}
