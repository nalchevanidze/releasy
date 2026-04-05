import { beforeEach, describe, expect, test, vi } from "vitest";

const setOutput = vi.fn();
const setFailed = vi.fn();
const info = vi.fn();

vi.mock("@actions/core", () => ({
  setOutput: (...args: unknown[]) => setOutput(...args),
  setFailed: (...args: unknown[]) => setFailed(...args),
  info: (...args: unknown[]) => info(...args),
}));

vi.mock("@relasy/actions-common", () => ({
  formatActionFailure: (_action: string, error: unknown) => String(error),
}));

vi.mock("@relasy/core", () => ({
  loadRelasy: vi.fn(async () => ({})),
  buildReleasePlan: vi.fn(async () => ({
    ok: true,
    data: {
      version: "v1.2.3",
      baseBranch: "main",
      labelMode: "strict",
      detectionUse: ["labels"],
    },
  })),
  draftRelease: vi.fn(async () => ({
    ok: true,
    data: {
      version: "v1.2.3",
      releaseBranch: "release-v1.2.3",
      prNumber: 7,
      prUrl: "https://github.com/acme/demo/pull/7",
    },
  })),
}));

describe("draft-release outputs contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("sets all declared outputs", async () => {
    const { run } = await import("./index");
    await run();

    expect(setOutput).toHaveBeenCalledWith("version", "v1.2.3");
    expect(setOutput).toHaveBeenCalledWith(
      "release_branch",
      "release-v1.2.3",
    );
    expect(setOutput).toHaveBeenCalledWith("pr_number", "7");
    expect(setOutput).toHaveBeenCalledWith(
      "pr_url",
      "https://github.com/acme/demo/pull/7",
    );
    expect(setFailed).not.toHaveBeenCalled();
  });
});
