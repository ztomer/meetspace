import { describe, expect, test } from "vitest";

import { sortProviders } from "./sort-providers";

describe("sortProviders", () => {
  test("keeps Meetspace first and Custom last", () => {
    const sorted = sortProviders([
      { id: "custom", displayName: "Custom" },
      { id: "fireworks", displayName: "Fireworks", disabled: true },
      { id: "openai", displayName: "OpenAI" },
      { id: "meetspace", displayName: "Meetspace" },
    ]);

    expect(sorted.map((provider) => provider.id)).toEqual([
      "meetspace",
      "openai",
      "fireworks",
      "custom",
    ]);
  });
});
