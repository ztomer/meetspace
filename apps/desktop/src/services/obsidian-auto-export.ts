import type { Store } from "tinybase/with-schemas";

import { exportSessionToObsidian } from "~/integrations/obsidian";

/**
 * If the user has enabled auto-export to Obsidian and configured a vault,
 * write the session as a markdown file. Failures are logged, not thrown —
 * we never want auto-export to break the session-stop flow.
 */
// Intentionally typed as loose tinybase Stores rather than the project-specific
// Mergeable variants, so callers holding either flavor (e.g. from React
// `useStore`) can pass them in without a cast.
export async function maybeAutoExportToObsidian(
  // biome-ignore lint/suspicious/noExplicitAny: tinybase generic
  mainStore: Store<any>,
  // biome-ignore lint/suspicious/noExplicitAny: tinybase generic
  settingsStore: Store<any>,
  sessionId: string,
): Promise<void> {
  const autoExport = settingsStore.getValue("obsidian_auto_export");
  if (autoExport !== true) {
    return;
  }

  const vaultPath = settingsStore.getValue("obsidian_vault_path");
  if (typeof vaultPath !== "string" || !vaultPath) {
    return;
  }

  const subfolder = settingsStore.getValue("obsidian_subfolder");

  const title = mainStore.getCell("sessions", sessionId, "title");
  const createdAt = mainStore.getCell("sessions", sessionId, "created_at");
  const rawMd = mainStore.getCell("sessions", sessionId, "raw_md");

  try {
    await exportSessionToObsidian({
      vaultPath,
      subfolder: typeof subfolder === "string" ? subfolder : "Anarlog",
      sessionTitle: typeof title === "string" ? title : "Untitled",
      sessionCreatedAt:
        typeof createdAt === "string" ? createdAt : new Date().toISOString(),
      rawMd: typeof rawMd === "string" ? rawMd : "",
    });
  } catch (error) {
    console.error("[obsidian-auto-export] failed", { sessionId, error });
  }
}
