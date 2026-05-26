import { GoogleCalendarIntegration } from "./google-calendar";
import { LinearIntegration } from "./linear";
import { NotionIntegration } from "./notion";
import { ObsidianIntegration } from "./obsidian";
import { OutlookCalendarIntegration } from "./outlook-calendar";

export function SettingsIntegrations() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="mb-4 font-sans text-lg font-semibold">Integrations</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Connect Meetspace to other tools you use. All integrations run
          locally; tokens stay on this device.
        </p>
      </div>
      <ObsidianIntegration />
      <GoogleCalendarIntegration />
      <OutlookCalendarIntegration />
      <NotionIntegration />
      <LinearIntegration />
    </div>
  );
}
