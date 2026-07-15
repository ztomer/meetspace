import { describe, expect, test } from "vitest";

import {
  getConfiguredProviderIds,
  getConfiguredProviders,
  getVisibleModelSelection,
} from "./selection";

describe("getVisibleModelSelection", () => {
  test("hides stale selections for an unconfigured provider", () => {
    expect(getVisibleModelSelection("openai", "gpt-5.5", false)).toEqual({
      provider: "",
      model: "",
    });
  });

  test("keeps a configured provider visible when its model is missing", () => {
    expect(getVisibleModelSelection("meetspace", undefined, true)).toEqual({
      provider: "meetspace",
      model: "",
    });
  });

  test("shows a complete configured selection", () => {
    expect(getVisibleModelSelection("openai", "gpt-5.5", true)).toEqual({
      provider: "openai",
      model: "gpt-5.5",
    });
  });
});

describe("getConfiguredProviders", () => {
  test("returns only providers whose configuration is complete", () => {
    const providers = [
      { id: "meetspace" },
      { id: "deepgram" },
      { id: "openai" },
    ];

    expect(
      getConfiguredProviders(providers, {
        meetspace: { configured: true },
        deepgram: { configured: true },
        openai: { configured: false },
      }),
    ).toEqual([{ id: "meetspace" }, { id: "deepgram" }]);
  });
});

describe("getConfiguredProviderIds", () => {
  test("keeps the configured active provider first", () => {
    const providers = [
      { id: "meetspace" },
      { id: "deepgram" },
      { id: "openai" },
    ];

    expect(
      getConfiguredProviderIds(
        providers,
        {
          meetspace: { configured: true },
          deepgram: { configured: true },
          openai: { configured: false },
        },
        "deepgram",
      ),
    ).toEqual(["deepgram", "meetspace"]);
  });

  test("falls back to configured provider order when the active provider is unavailable", () => {
    const providers = [
      { id: "meetspace" },
      { id: "deepgram" },
      { id: "openai" },
    ];

    expect(
      getConfiguredProviderIds(
        providers,
        {
          meetspace: { configured: true },
          deepgram: { configured: true },
          openai: { configured: false },
        },
        "openai",
      ),
    ).toEqual(["meetspace", "deepgram"]);
  });
});
