import type { TaskArgsMap, TaskArgsMapTransformed, TaskConfig } from ".";

import { loadSessionContentSnapshot } from "~/session/content-queries";

export const titleTransform: Pick<TaskConfig<"title">, "transformArgs"> = {
  transformArgs,
};

async function transformArgs(
  args: TaskArgsMap["title"],
  _store: any,
  settingsStore: any,
): Promise<TaskArgsMapTransformed["title"]> {
  const snapshot = await loadSessionContentSnapshot(args.sessionId);
  const enhancedNote =
    snapshot?.enhancedNotes.map((n) => n.markdown).join("\n\n") ?? "";
  const language = getLanguage(settingsStore);
  return { language, enhancedNote };
}

function getLanguage(settingsStore: any): string | null {
  const value = settingsStore.ai_language;
  return typeof value === "string" && value.length > 0 ? value : null;
}
