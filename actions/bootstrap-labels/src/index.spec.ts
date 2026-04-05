import { beforeEach, describe, expect, test, vi } from "vitest";

const setFailed = vi.fn();
const info = vi.fn();

const context = {
  repo: { owner: "acme", repo: "demo" },
};

vi.mock("@actions/core", () => ({
  setFailed: (...args: unknown[]) => setFailed(...args),
  info: (...args: unknown[]) => info(...args),
}));

vi.mock("@actions/github", () => ({
  context,
  getOctokit: vi.fn(),
}));

vi.mock("@relasy/core", () => ({
  loadRelasy: vi.fn(async () => ({
    labels: vi.fn(() => []),
  })),
}));

describe("bootstrap-labels action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.GITHUB_TOKEN;
    delete process.env.RELASY_DRY_RUN;
  });

  test("fails with clear message when GITHUB_TOKEN is missing", async () => {
    const { run } = await import("./index");

    await run();

    expect(setFailed).toHaveBeenCalledWith(
      expect.stringContaining("Missing GITHUB_TOKEN"),
    );
  });
});
