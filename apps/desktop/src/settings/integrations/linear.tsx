import { Input } from "@meetspace/ui/components/ui/input";

import { useSetSettingValue } from "~/settings/queries";
import { useConfigValues } from "~/shared/config";

export function LinearIntegration() {
  const { linear_api_key } = useConfigValues(["linear_api_key"] as const);
  const setKey = useSetSettingValue("linear_api_key");

  return (
    <section className="border-border rounded-lg border p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Linear</h3>
        <p className="text-muted-foreground text-xs">
          Create Linear issues from a session. Bring your own personal API key —
          it stays on this device.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="linear-key" className="text-sm font-medium">
            Personal API key
          </label>
          <Input
            id="linear-key"
            type="password"
            value={linear_api_key ?? ""}
            onChange={(e) => setKey(e.target.value)}
            placeholder="lin_api_..."
            className="shadow-none"
          />
          <p className="text-muted-foreground text-xs">
            Create a key at{" "}
            <span className="font-mono">linear.app/settings/api</span>. You'll
            be prompted for a team when creating an issue from a session.
          </p>
        </div>
      </div>
    </section>
  );
}
