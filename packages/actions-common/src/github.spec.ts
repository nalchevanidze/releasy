import { describe, expect, test } from "vitest";
import { requireGitHubToken, resolvePrNumber, resolveRepo } from "./github";

describe("actions-common github helpers", () => {
  test("resolveRepo prefers context repo values", () => {
    const repo = resolveRepo({ repo: { owner: "org", repo: "name" } });
    expect(repo).toEqual({ owner: "org", repo: "name" });
  });

  test("resolveRepo falls back to env vars", () => {
    const repo = resolveRepo(
      { repo: {} },
      { RELASY_OWNER: "env-org", RELASY_REPO: "env-repo" } as NodeJS.ProcessEnv,
    );

    expect(repo).toEqual({ owner: "env-org", repo: "env-repo" });
  });

  test("resolveRepo throws when owner/repo are missing", () => {
    expect(() =>
      resolveRepo({ repo: {} }, {} as NodeJS.ProcessEnv),
    ).toThrow("Could not resolve owner/repo");
  });

  test("resolvePrNumber prefers payload PR number", () => {
    const number = resolvePrNumber(
      {
        repo: {},
        issue: { number: 10 },
        payload: { pull_request: { number: 20 } },
      },
      { RELASY_PR_NUMBER: "30" } as NodeJS.ProcessEnv,
    );

    expect(number).toBe(20);
  });

  test("resolvePrNumber falls back to issue number", () => {
    const number = resolvePrNumber(
      { repo: {}, issue: { number: 10 }, payload: {} },
      { RELASY_PR_NUMBER: "30" } as NodeJS.ProcessEnv,
    );

    expect(number).toBe(10);
  });

  test("resolvePrNumber falls back to env", () => {
    const number = resolvePrNumber(
      { repo: {}, issue: {}, payload: {} },
      { RELASY_PR_NUMBER: "42" } as NodeJS.ProcessEnv,
    );

    expect(number).toBe(42);
  });

  test("resolvePrNumber throws when unavailable/invalid", () => {
    expect(() =>
      resolvePrNumber(
        { repo: {}, issue: {}, payload: {} },
        { RELASY_PR_NUMBER: "nan" } as NodeJS.ProcessEnv,
      ),
    ).toThrow("Could not determine PR number");
  });

  test("requireGitHubToken throws when missing", () => {
    expect(() => requireGitHubToken({} as NodeJS.ProcessEnv)).toThrow(
      "Missing GITHUB_TOKEN",
    );
  });
});
