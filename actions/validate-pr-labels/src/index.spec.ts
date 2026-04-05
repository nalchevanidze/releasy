import { beforeEach, describe, expect, test, vi } from "vitest";

const setFailed = vi.fn();
const setOutput = vi.fn();
const info = vi.fn();
const getInput = vi.fn();

const pullsGet = vi.fn();
const getOctokit = vi.fn(() => ({
  rest: { pulls: { get: (...args: unknown[]) => pullsGet(...args) } },
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
    },
    parseLabels: vi.fn(() => ({
      changeTypes: [{ changeType: "feature" }],
    })),
  })),
  checkLabels: vi.fn(() => ({ ok: true, data: { changeType: "feature" } })),
}));

describe("validate-pr-labels action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getInput.mockReturnValue("true");
    process.env.GITHUB_TOKEN = "token";
    delete process.env.RELASY_OWNER;
    delete process.env.RELASY_REPO;
    delete process.env.RELASY_PR_NUMBER;

    context.repo.owner = "acme";
    context.repo.repo = "demo";
    context.issue.number = 10;
    context.payload.pull_request = {
      number: 10,
      head: { ref: "feature-branch" },
      labels: [{ name: "✨ feature" }],
    };

    pullsGet.mockResolvedValue({ data: { labels: [{ name: "🐛 fix" }] } });
  });

  test("sets string change_type output", async () => {
    const { run } = await import("./index");

    await run();

    expect(setOutput).toHaveBeenCalledWith("change_type", "feature");
    expect(setFailed).not.toHaveBeenCalled();
  });

  test("getCurrentPrLabels uses payload labels by default", async () => {
    const { getCurrentPrLabels } = await import("./index");

    context.payload.pull_request = {
      number: 10,
      head: { ref: "feature-branch" },
      labels: [{ name: "✨ feature" }, "📦 core"] as unknown as { name: string }[],
    };

    await expect(getCurrentPrLabels()).resolves.toEqual([
      "✨ feature",
      "📦 core",
    ]);
    expect(getOctokit).not.toHaveBeenCalled();
  });

  test("getCurrentPrLabels refetches from API when requested", async () => {
    const { getCurrentPrLabels } = await import("./index");

    await expect(getCurrentPrLabels({ refetch: true })).resolves.toEqual([
      "🐛 fix",
    ]);

    expect(getOctokit).toHaveBeenCalledWith("token");
    expect(pullsGet).toHaveBeenCalledWith({
      owner: "acme",
      repo: "demo",
      pull_number: 10,
    });
  });

  test("getCurrentPrLabels supports local-run fallback via env", async () => {
    const { getCurrentPrLabels } = await import("./index");

    context.repo.owner = "";
    context.repo.repo = "";
    context.issue.number = undefined as unknown as number;
    context.payload.pull_request = undefined;
    process.env.RELASY_OWNER = "env-org";
    process.env.RELASY_REPO = "env-repo";
    process.env.RELASY_PR_NUMBER = "99";

    pullsGet.mockResolvedValue({ data: { labels: [{ name: "🧹 chore" }] } });

    await expect(getCurrentPrLabels({ refetch: true })).resolves.toEqual([
      "🧹 chore",
    ]);

    expect(pullsGet).toHaveBeenCalledWith({
      owner: "env-org",
      repo: "env-repo",
      pull_number: 99,
    });
  });
});
