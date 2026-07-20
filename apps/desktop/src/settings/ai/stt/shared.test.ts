import { describe, expect, test } from "vitest";

import { displayModelId } from "./shared";

describe("STT model display ids", () => {
  test("returns model id unchanged", () => {
    expect(displayModelId("cloud")).toBe("cloud");
  });
});
