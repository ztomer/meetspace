import { describe, expect, it } from "vitest";

import {
  keepLocalProviders,
  LOCAL_LLM_PROVIDER_IDS,
  LOCAL_STT_PROVIDER_IDS,
} from "./local-providers";

import { PROVIDERS as LLM_PROVIDERS } from "~/settings/ai/llm/shared";
import { PROVIDERS as STT_PROVIDERS } from "~/settings/ai/stt/shared";

// Guards the fork's "no cloud providers visible" policy. If an upstream sync
// reintroduces hosted providers into the lists, these fail until the allowlist
// filters them out.
describe("local-provider visibility", () => {
  it("LLM providers shown are all local-allowlisted", () => {
    for (const p of LLM_PROVIDERS) {
      expect(LOCAL_LLM_PROVIDER_IDS).toContain(p.id);
    }
  });

  it("STT providers shown are all local-allowlisted", () => {
    for (const p of STT_PROVIDERS) {
      expect(LOCAL_STT_PROVIDER_IDS).toContain(p.id);
    }
  });

  it("keepLocalProviders drops anything not allowlisted", () => {
    const filtered = keepLocalProviders(
      [{ id: "osaurus" }, { id: "openai" }, { id: "anthropic" }],
      LOCAL_LLM_PROVIDER_IDS,
    );
    expect(filtered.map((p) => p.id)).toEqual(["osaurus"]);
  });
});
