import { describe, expect, test } from "vitest";
import { requireGitHubToken, resolvePrNumber, resolveRepo } from "./github";

describe("actions-common github helpers", () => {
  test("resolveRepo prefers context repo values", () => {
    const repo = resolveRepo({ repo: { owner: "org", repo: "name" } });
    expect(repo).toEqual({ owner: "org", repo: "name" });
  });

  test("resolvePrNumber falls back to env", () => {
    const number = resolvePrNumber(
      { repo: {}, issue: {}, payload: {} },
      { RELASY_PR_NUMBER: "42" } as NodeJS.ProcessEnv,
    );

    expect(number).toBe(42);
  });

  test("requireGitHubToken throws when missing", () => {
    expect(() => requireGitHubToken({} as NodeJS.ProcessEnv)).toThrow(
      "Missing GITHUB_TOKEN",
    );
  });
});
