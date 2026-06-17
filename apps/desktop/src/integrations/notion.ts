import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

const NOTION_VERSION = "2022-06-28";

export type NotionExportInput = {
  token: string;
  databaseId: string;
  sessionTitle: string;
  sessionCreatedAt: string;
  rawMd: string;
  summaryMd?: string;
  transcriptText?: string;
};

/**
 * Split a markdown body into Notion blocks. We only support the common cases:
 * headings (#, ##, ###), bullet items (- / *), and plain paragraphs. Anything
 * else falls through as a paragraph. Notion limits rich text per block to 2000
 * chars; longer lines get chunked.
 */
function mdToBlocks(md: string): unknown[] {
  const lines = md.split(/\r?\n/);
  const blocks: unknown[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      const type = `heading_${level}` as
        | "heading_1"
        | "heading_2"
        | "heading_3";
      blocks.push({
        object: "block",
        type,
        [type]: { rich_text: richText(text) },
      });
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: richText(bullet[1]) },
      });
      continue;
    }

    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: richText(line) },
    });
  }

  return blocks;
}

function richText(text: string): unknown[] {
  // Notion caps each rich_text segment at 2000 chars.
  const out: unknown[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    const chunk = remaining.slice(0, 2000);
    remaining = remaining.slice(2000);
    out.push({ type: "text", text: { content: chunk } });
  }
  return out;
}

/** Create a page in the configured Notion database. */
export async function exportSessionToNotion(
  input: NotionExportInput,
): Promise<{ pageUrl: string }> {
  if (!input.token) throw new Error("Notion token is not configured");
  if (!input.databaseId)
    throw new Error("Notion database ID is not configured");

  const body: string[] = [];
  if (input.rawMd?.trim()) {
    body.push("## Notes", input.rawMd.trim(), "");
  }
  if (input.summaryMd?.trim()) {
    body.push("## Summary", input.summaryMd.trim(), "");
  }
  if (input.transcriptText?.trim()) {
    body.push("## Transcript", input.transcriptText.trim(), "");
  }

  const children = mdToBlocks(body.join("\n"));

  const payload = {
    parent: { database_id: input.databaseId },
    properties: {
      // Database must have a title property called "Name". Most templates do.
      Name: {
        title: [{ text: { content: input.sessionTitle || "Untitled" } }],
      },
    },
    children,
  };

  const res = await tauriFetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion API ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { url?: string };
  return { pageUrl: data.url ?? "" };
}
