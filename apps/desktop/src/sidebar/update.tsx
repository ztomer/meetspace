import { type UnlistenFn } from "@tauri-apps/api/event";
import { message } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";

import { commands, events } from "@meetspace/plugin-updater2";
import { Button } from "@meetspace/ui/components/ui/button";
import { cn } from "@meetspace/utils";

export function Update() {
  const { version } = useUpdate();
  const [installing, setInstalling] = useState(false);

  const handleInstallUpdate = useCallback(async () => {
    if (!version) {
      return;
    }
    setInstalling(true);
    const installResult = await commands.install(version);
    if (installResult.status !== "ok") {
      await message(`Failed to install update: ${installResult.error}`, {
        title: "Update Failed",
        kind: "error",
      });
      return;
    }

    const postInstallResult = await commands.postinstall(installResult.data);
    if (postInstallResult.status !== "ok") {
      await message(`Failed to apply update: ${postInstallResult.error}`, {
        title: "Update Failed",
        kind: "error",
      });
    }
    setInstalling(false);
  }, [version]);

  if (!version) {
    return null;
  }

  return (
    <Button
      size="sm"
      onClick={handleInstallUpdate}
      disabled={installing}
      className={cn([
        "rounded-full px-3",
        "from-primary/80 to-primary/70 bg-linear-to-t",
        "hover:from-primary/70 hover:to-primary/60",
      ])}
    >
      {installing ? "Installing..." : "Install Update"}
    </Button>
  );
}

function useUpdate() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    void events.updateReadyEvent
      .listen(({ payload }) => {
        setVersion(payload.version);
      })
      .then((f) => {
        unlisten = f;
      });

    return () => {
      unlisten?.();
    };
  }, []);

  return { version };
}
