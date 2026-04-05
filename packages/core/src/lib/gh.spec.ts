import { beforeEach, describe, expect, test, vi } from "vitest";

let gitMock = vi.fn();
let isUserSetMock = vi.fn();
let pullsListMock = vi.fn();
let pullsCreateMock = vi.fn();
let reposGetMock = vi.fn();

vi.mock("./git", () => ({
  git: (...args: string[]) => gitMock(...args),
  isUserSet: (...args: unknown[]) => isUserSetMock(...args),
}));

vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: {
      pulls: {
        list: (...args: unknown[]) => pullsListMock(...args),
        create: (...args: unknown[]) => pullsCreateMock(...args),
      },
      repos: {
        get: (...args: unknown[]) => reposGetMock(...args),
      },
    },
    graphql: vi.fn(),
  })),
}));

describe("Github release flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_TOKEN = "test-token";
    delete process.env.RELASY_DRY_RUN;

    gitMock = vi.fn().mockReturnValue("");
    isUserSetMock = vi.fn().mockReturnValue(true);
    pullsListMock = vi.fn().mockResolvedValue({ data: [] });
    pullsCreateMock = vi.fn().mockResolvedValue({
      data: { number: 12, html_url: "https://github.com/org/repo/pull/12" },
    });
    reposGetMock = vi.fn().mockResolvedValue({
      data: { default_branch: "main" },
    });
  });

  test("uses configured base branch when listing and creating release PR", async () => {
    const [{ Github }, { Version }] = await Promise.all([
      import("./gh"),
      import("./version"),
    ]);

    const github = new Github("org/repo", undefined, "develop");

    await github.release(Version.parse("1.2.3"), "notes");

    expect(pullsListMock).toHaveBeenCalledWith(
      expect.objectContaining({ base: "develop" }),
    );

    expect(pullsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ base: "develop" }),
    );
  });

  test("auto-detects default branch when baseBranch is not configured", async () => {
    const [{ Github }, { Version }] = await Promise.all([
      import("./gh"),
      import("./version"),
    ]);

    const github = new Github("org/repo");

    await github.release(Version.parse("1.2.3"), "notes");

    expect(reposGetMock).toHaveBeenCalledWith({ owner: "org", repo: "repo" });
    expect(pullsListMock).toHaveBeenCalledWith(
      expect.objectContaining({ base: "main" }),
    );
  });

  test("falls back to authenticated https push when origin push fails", async () => {
    let failOriginPushOnce = true;

    gitMock = vi.fn().mockImplementation((...args: string[]) => {
      if (args[0] === "push" && args[1] === "origin" && failOriginPushOnce) {
        failOriginPushOnce = false;
        throw new Error("auth failed");
      }

      return "";
    });

    const [{ Github }, { Version }] = await Promise.all([
      import("./gh"),
      import("./version"),
    ]);

    const github = new Github("org/repo");

    await github.release(Version.parse("1.2.3"), "notes");

    expect(gitMock).toHaveBeenCalledWith("push", "origin", "HEAD:release-v1.2.3");

    const fallbackCall = gitMock.mock.calls.find(
      (args) => args[0] === "-c" && String(args[2]).includes("push"),
    );

    expect(fallbackCall).toBeDefined();
    expect(String(fallbackCall?.[1])).toContain("extraheader=AUTHORIZATION: basic");
  });
});
