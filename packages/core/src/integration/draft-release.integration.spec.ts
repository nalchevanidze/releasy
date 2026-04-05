import { describe, expect, test } from "vitest";
import { draftRelease } from "../app";

describe("integration: draftRelease use-case", () => {
  test("returns structured success output", async () => {
    const iRelasy = {
      changelog: async () => "notes",
      module: {
        postBump: async () => undefined,
        version: () => ({ toString: () => "v1.2.3" }),
      },
      github: {
        setup: () => undefined,
        release: async () => ({
          data: { number: 42, html_url: "https://github.com/acme/demo/pull/42" },
        }),
      },
    };

    const result = await draftRelease(iRelasy);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.version).toBe("v1.2.3");
      expect(result.data.prNumber).toBe(42);
    }
  });
});
