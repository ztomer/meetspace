import { join } from "@tauri-apps/api/path";

import { commands as fs2Commands } from "@meetspace/plugin-fs2";

export type ObsidianExportInput = {
  vaultPath: string;
  subfolder: string;
  sessionTitle: string;
  sessionCreatedAt: string;
  rawMd: string;
  participantNames?: string[];
  summaryMd?: string;
  transcriptText?: string;
};

/** Sanitize a string so it's safe to use as a file name on macOS/Linux/Windows. */
export function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "Untitled"
  );
}

function isoDatePrefix(created: string): string {
  // ISO date prefix (YYYY-MM-DD). Falls back to today if parsing fails.
  const d = new Date(created);
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

export function buildObsidianMarkdown(input: ObsidianExportInput): string {
  const datePrefix = isoDatePrefix(input.sessionCreatedAt);
  const tags = ["meetspace"];
  const frontmatter = [
    "---",
    `date: ${datePrefix}`,
    `created: ${input.sessionCreatedAt}`,
    `title: "${input.sessionTitle.replace(/"/g, '\\"')}"`,
    `tags: [${tags.join(", ")}]`,
    "source: meetspace",
    ...(input.participantNames && input.participantNames.length > 0
      ? [
          `participants: [${input.participantNames
            .map((p) => `"${p.replace(/"/g, '\\"')}"`)
            .join(", ")}]`,
        ]
      : []),
    "---",
    "",
  ];

  const sections: string[] = [...frontmatter];
  sections.push(`# ${input.sessionTitle || "Untitled"}`, "");

  if (input.rawMd?.trim()) {
    sections.push("## Notes", "", input.rawMd.trim(), "");
  }
  if (input.summaryMd?.trim()) {
    sections.push("## Summary", "", input.summaryMd.trim(), "");
  }
  if (input.transcriptText?.trim()) {
    sections.push("## Transcript", "", input.transcriptText.trim(), "");
  }

  return sections.join("\n");
}

/** Write a session to <vaultPath>/<subfolder>/<YYYY-MM-DD>-<title>.md. */
export async function exportSessionToObsidian(
  input: ObsidianExportInput,
): Promise<{ path: string }> {
  if (!input.vaultPath) {
    throw new Error("Obsidian vault folder is not configured");
  }
  const datePrefix = isoDatePrefix(input.sessionCreatedAt);
  const safeTitle = sanitizeFilename(input.sessionTitle || "Untitled");
  const fileName = `${datePrefix}-${safeTitle}.md`;

  const subfolderTrimmed = (input.subfolder ?? "").trim();
  const fullPath = subfolderTrimmed
    ? await join(input.vaultPath, subfolderTrimmed, fileName)
    : await join(input.vaultPath, fileName);

  const content = buildObsidianMarkdown(input);
  const result = await fs2Commands.writeTextFile(fullPath, content);
  if (result.status === "error") {
    throw new Error(result.error);
  }
  return { path: fullPath };
}
