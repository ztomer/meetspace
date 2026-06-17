import { commands as openerCommands } from "@meetspace/plugin-opener2";

export async function openEditorLink(href: string) {
  await openerCommands.openUrl(href, null);
}
