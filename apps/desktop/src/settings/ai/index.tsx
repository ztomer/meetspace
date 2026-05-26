import { ConfigureProviders as LlmConfigureProviders } from "./llm/configure";
import { LlmSettingsProvider } from "./llm/context";
import { SelectProviderAndModel as LlmSelectProviderAndModel } from "./llm/select";
import { ConfigureProviders as SttConfigureProviders } from "./stt/configure";
import { SttSettingsProvider } from "./stt/context";
import {
  SelectProviderAndModel as SttSelectProviderAndModel,
  TranscriptionLanguageWarningBanner,
} from "./stt/select";

import { SettingsPageTitle } from "~/settings/page-title";

/**
 * Unified Intelligence settings page — combines what used to be two separate
 * tabs (Transcription + Intelligence) into one. Speech-to-text providers come
 * first (you usually configure them once and forget), then language model
 * providers (you swap these more often).
 */
export function Intelligence() {
  return (
    <SttSettingsProvider>
      <LlmSettingsProvider>
        <TranscriptionLanguageWarningBanner />
        <div className="flex flex-col gap-10">
          <SettingsPageTitle title="Intelligence" />

          <section className="flex flex-col gap-6">
            <h2 className="text-md font-sans font-semibold">
              Speech-to-text
            </h2>
            <SttSelectProviderAndModel />
            <SttConfigureProviders />
          </section>

          <section className="flex flex-col gap-6">
            <h2 className="text-md font-sans font-semibold">
              Language model
            </h2>
            <LlmSelectProviderAndModel />
            <LlmConfigureProviders />
          </section>
        </div>
      </LlmSettingsProvider>
    </SttSettingsProvider>
  );
}
