import { Input } from "@meetspace/ui/components/ui/input";

import { useSetSettingValue } from "~/settings/queries";
import { useConfigValues } from "~/shared/config";

export function NotionIntegration() {
  const { notion_token, notion_database_id } = useConfigValues([
    "notion_token",
    "notion_database_id",
  ] as const);

  const setToken = useSetSettingValue("notion_token");
  const setDb = useSetSettingValue("notion_database_id");

  return (
    <section className="border-border rounded-lg border p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Notion</h3>
        <p className="text-muted-foreground text-xs">
          Export sessions as new pages in a Notion database. Bring your own
          integration token — it stays on this device.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="notion-token" className="text-sm font-medium">
            Integration token
          </label>
          <Input
            id="notion-token"
            type="password"
            value={notion_token ?? ""}
            onChange={(e) => setToken(e.target.value)}
            placeholder="secret_..."
            className="shadow-none"
          />
          <p className="text-muted-foreground text-xs">
            Create an internal integration at{" "}
            <span className="font-mono">notion.so/profile/integrations</span>{" "}
            and share your target database with it.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="notion-db" className="text-sm font-medium">
            Database ID
          </label>
          <Input
            id="notion-db"
            value={notion_database_id ?? ""}
            onChange={(e) => setDb(e.target.value)}
            placeholder="32-char database id"
            className="shadow-none"
          />
          <p className="text-muted-foreground text-xs">
            Open the database in Notion and copy the 32-character id from the
            URL. The database needs a title property called{" "}
            <code className="bg-muted rounded px-1 py-0.5 text-[10px]">
              Name
            </code>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
