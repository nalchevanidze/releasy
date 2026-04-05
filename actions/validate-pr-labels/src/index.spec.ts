import { beforeEach, describe, expect, test, vi } from "vitest";

const setFailed = vi.fn();
const setOutput = vi.fn();
const info = vi.fn();
const getInput = vi.fn();

const pullsGet = vi.fn();
const pullsListFiles = vi.fn();
const issuesAddLabels = vi.fn();
const paginate = vi.fn(async (_method: unknown, _args: unknown) => [
  { filename: "packages/core/src/index.ts" },
]);

const getOctokit = vi.fn(() => ({
  rest: {
    pulls: {
      get: (...args: unknown[]) => pullsGet(...args),
      listFiles: (...args: unknown[]) => pullsListFiles(...args),
    },
    issues: {
      addLabels: (...args: unknown[]) => issuesAddLabels(...args),
    },
  },
  paginate: (...args: unknown[]) => paginate(...args),
}));

const context = {
  repo: { owner: "acme", repo: "demo" },
  issue: { number: 10 },
  payload: {
    pull_request: {
      number: 10,
      head: { ref: "feature-branch" },
      labels: [{ name: "✨ feature" }],
    },
  },
};

const checkLabels = vi.fn(() => ({ ok: true, data: { changeType: "feature" } }));
const evaluatePackageScopeRules = vi.fn(() => ({
  ok: true,
  data: {
    inferredScopes: ["core"],
    existingScopes: ["core"],
    missingScopes: [],
    conflictingScopes: [],
  },
}));

vi.mock("@actions/core", () => ({
  setFailed: (...args: unknown[]) => setFailed(...args),
  setOutput: (...args: unknown[]) => setOutput(...args),
  info: (...args: unknown[]) => info(...args),
  getInput: (...args: unknown[]) => getInput(...args),
}));

vi.mock("@actions/github", () => ({
  context,
  getOctokit: (...args: unknown[]) => getOctokit(...args),
}));

vi.mock("@relasy/core", () => ({
  loadRelasy: vi.fn(async () => ({
    config: {
      changeTypes: {
        feature: "feature",
        fix: "fix",
        chore: "chore",
        breaking: "breaking",
      },
      packageScopes: {
        core: { paths: ["packages/core/**"] },
      },
      rules: {
        requireInferredPackageLabels: true,
      },
    },
    parseLabels: vi.fn(() => ({
      changeTypes: [{ changeType: "feature" }],
      pkgs: [{ pkg: "core" }],
    })),
  })),
  checkLabels: (...args: unknown[]) => checkLabels(...args),
  evaluatePackageScopeRules: (...args: unknown[]) => evaluatePackageScopeRules(...args),
}));

describe("validate-pr-labels action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getInput.mockImplementation((name: string) => {
      if (name === "require_change_type") return "true";
      if (name === "auto_add_package_labels") return "false";
      return "";
    });
    process.env.GITHUB_TOKEN = "token";

    pullsGet.mockResolvedValue({ data: { labels: [{ name: "✨ feature" }, { name: "📦 core" }] } });
    pullsListFiles.mockResolvedValue([{ filename: "packages/core/src/index.ts" }]);
    paginate.mockResolvedValue([{ filename: "packages/core/src/index.ts" }]);
  });

  test("sets outputs including inferred/missing package labels", async () => {
    const { run } = await import("./index");

    await run();

    expect(setOutput).toHaveBeenCalledWith("change_type", "feature");
    expect(setOutput).toHaveBeenCalledWith("inferred_package_labels", "core");
    expect(setOutput).toHaveBeenCalledWith("missing_package_labels", "");
    expect(setFailed).not.toHaveBeenCalled();
  });

  test("auto-adds missing inferred package labels when enabled", async () => {
    let calls = 0;
    evaluatePackageScopeRules.mockImplementation(() => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: false,
          code: "LABEL_POLICY_ERROR",
          message: "Missing inferred package labels: 📦 core",
        };
      }

      return {
        ok: true,
        data: {
          inferredScopes: ["core"],
          existingScopes: ["core"],
          missingScopes: [],
          conflictingScopes: [],
        },
      };
    });

    getInput.mockImplementation((name: string) => {
      if (name === "require_change_type") return "true";
      if (name === "auto_add_package_labels") return "true";
      return "";
    });

    const { run } = await import("./index");
    await run();

    expect(issuesAddLabels).toHaveBeenCalledWith({
      owner: "acme",
      repo: "demo",
      issue_number: 10,
      labels: ["📦 core"],
    });
    expect(setFailed).not.toHaveBeenCalled();
  });

  test("getCurrentPrFiles fetches changed files via GitHub API", async () => {
    const { getCurrentPrFiles } = await import("./index");

    await expect(getCurrentPrFiles()).resolves.toEqual([
      "packages/core/src/index.ts",
    ]);

    expect(getOctokit).toHaveBeenCalledWith("token");
  });
});
