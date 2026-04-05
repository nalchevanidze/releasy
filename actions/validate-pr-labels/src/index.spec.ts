import { beforeEach, describe, expect, test, vi } from "vitest";

const setFailed = vi.fn();
const setOutput = vi.fn();
const info = vi.fn();
const getInput = vi.fn();

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
  getOctokit: vi.fn(),
}));

vi.mock("@relasy/core", () => ({
  Relasy: {
    load: vi.fn(async () => ({
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
  },
}));

describe("validate-pr-labels action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getInput.mockReturnValue("true");
  });

  test("sets string change_type output", async () => {
    const { run } = await import("./index");

    await run();

    expect(setOutput).toHaveBeenCalledWith("change_type", "feature");
    expect(setFailed).not.toHaveBeenCalled();
  });
});
