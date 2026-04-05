import { beforeEach, describe, expect, test, vi } from "vitest";

const setOutput = vi.fn();
const setFailed = vi.fn();
const info = vi.fn();

const context = {
  repo: { owner: "acme", repo: "demo" },
  payload: { pull_request: { body: "notes" } },
};

vi.mock("@actions/core", () => ({
  setOutput: (...args: unknown[]) => setOutput(...args),
  setFailed: (...args: unknown[]) => setFailed(...args),
  info: (...args: unknown[]) => info(...args),
  getInput: vi.fn(() => ""),
}));

vi.mock("@actions/github", () => ({
  context,
}));

vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    repos: {
      getReleaseByTag: vi.fn(),
      createRelease: vi.fn(),
    },
  })),
}));

vi.mock("@relasy/core", () => ({
  loadRelasy: vi.fn(async () => ({
    version: () => ({ toString: () => "v1.2.3" }),
  })),
  withRetry: async <T>(_label: string, fn: () => Promise<T>) => fn(),
}));

describe("publish-release action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RELASY_DRY_RUN = "true";
    process.env.GITHUB_TOKEN = "token";
  });

  test("sets dry-run outputs", async () => {
    const { run } = await import("./index");

    await run();

    expect(setOutput).toHaveBeenCalledWith("id", "0");
    expect(setOutput).toHaveBeenCalledWith(
      "upload_url",
      "https://uploads.github.com/repos/acme/demo/releases/0/assets{?name,label}",
    );
    expect(setFailed).not.toHaveBeenCalled();
  });
});
