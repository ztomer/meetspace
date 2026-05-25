import {
  Accordion,
} from "@hypr/ui/components/ui/accordion";

import { useLlmSettings } from "./context";
import { ProviderId, PROVIDERS } from "./shared";

import {
  NonHyprProviderCard,
  StyledStreamdown,
} from "~/settings/ai/shared";

export function ConfigureProviders() {
  const { accordionValue, setAccordionValue } = useLlmSettings();

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-md font-sans font-semibold">Configure Providers</h3>
      <Accordion
        type="single"
        collapsible
        className="flex flex-col gap-3"
        value={accordionValue}
        onValueChange={setAccordionValue}
      >
        {PROVIDERS.map((provider) => (
          <NonHyprProviderCard
            key={provider.id}
            config={provider}
            providerType="llm"
            providers={PROVIDERS}
            providerContext={<ProviderContext providerId={provider.id} />}
          />
        ))}
      </Accordion>
    </div>
  );
}

function ProviderContext({ providerId }: { providerId: ProviderId }) {
  const content =
    providerId === "osaurus"
      ? "Local OpenAI-compatible server.\n- Default port: **1337** (change Base URL below if yours differs)\n- See [Osaurus on GitHub](https://github.com/dinoki-ai/osaurus) for install instructions"
      : providerId === "lmstudio"
        ? "- Ensure LM Studio server is **running** (default port 1234)\n- Enable **CORS** in LM Studio config"
        : providerId === "ollama"
          ? "- Ensure Ollama is **running** (`ollama serve`)\n- Pull a model first (`ollama pull llama3.2`)"
          : providerId === "custom"
            ? "Any **OpenAI-compatible** endpoint works (OpenRouter, vLLM, llama.cpp server, cloud providers via a proxy, etc.)."
            : "";

  if (!content) {
    return null;
  }

  return <StyledStreamdown className="mb-3">{content}</StyledStreamdown>;
}
