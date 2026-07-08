import { ConfigureProviders } from "./configure";
import { SttSettingsProvider } from "./context";
<<<<<<< HEAD
import { SelectProviderAndModel } from "./select";
||||||| parent of 92b503ec7 (chore: sync upstream to desktop_v1.1.10 and resolve conflicts)
import {
  SelectProviderAndModel,
  TranscriptionLanguageWarningToast,
} from "./select";
=======
import {
  SelectProviderAndModel,
  TranscriptionLanguageWarningBanner,
} from "./select";
>>>>>>> 92b503ec7 (chore: sync upstream to desktop_v1.1.10 and resolve conflicts)

import { SettingsPageTitle } from "~/settings/page-title";

export function STT() {
  return (
    <SttSettingsProvider>
<<<<<<< HEAD
||||||| parent of 92b503ec7 (chore: sync upstream to desktop_v1.1.10 and resolve conflicts)
      <TranscriptionLanguageWarningToast />
=======
      <TranscriptionLanguageWarningBanner />
>>>>>>> 92b503ec7 (chore: sync upstream to desktop_v1.1.10 and resolve conflicts)
      <div className="flex flex-col gap-6">
        <SettingsPageTitle title="Transcription" />
        <SelectProviderAndModel />
        <ConfigureProviders />
      </div>
    </SttSettingsProvider>
  );
}
