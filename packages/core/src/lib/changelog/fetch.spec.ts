import { describe, expect, test, vi } from "vitest";
import { FetchApi, parsePRNumberFromCommitMessage } from "./fetch";
import { Version } from "../version";

vi.mock("../git", () => ({
  commitsAfterVersion: vi.fn(() => ["c1", "c2"]),
}));

describe("parsePRNumberFromCommitMessage", () => {
  test("parses squash merge format", () => {
    expect(parsePRNumberFromCommitMessage("feat: add X (#123)")).toBe(123);
  });

  test("parses merge commit format", () => {
    expect(
      parsePRNumberFromCommitMessage("Merge pull request #456 from org/branch"),
    ).toBe(456);
  });

  test("parses PR # format", () => {
    expect(parsePRNumberFromCommitMessage("fix: bug PR#789")).toBe(789);
  });

  test("parses plain #number fallback", () => {
    expect(parsePRNumberFromCommitMessage("refactor around #42")).toBe(42);
  });

  test("returns undefined when no PR number exists", () => {
    expect(
      parsePRNumberFromCommitMessage("chore: update docs"),
    ).toBeUndefined();
  });
});

describe("FetchApi non-PR commit policy", () => {
  const buildApi = (policy: "include" | "skip" | "strict-fail") => {
    const commits = [
      {
        oid: "abc1234",
        message: "feat: from pr (#10)",
        author: { name: "Dev", user: { login: "dev", url: "https://u/dev" } },
        associatedPullRequests: {
          nodes: [{ number: 10, repository: { nameWithOwner: "acme/demo" } }],
        },
      },
      {
        oid: "def5678",
        message: "chore: standalone commit",
        author: { name: "Bot", user: null },
        associatedPullRequests: { nodes: [] },
      },
    ];

    const prs = [
      {
        number: 10,
        title: "From PR",
        body: "",
        author: { login: "dev", url: "https://u/dev" },
        labels: { nodes: [] },
      },
    ];

    return {
      config: {
        gh: "acme/demo",
        pkgs: { core: { name: "@acme/core" } },
        project: { type: "npm" },
        changeTypes: {
          breaking: "Breaking",
          feature: "Features",
          fix: "Fixes",
          chore: "Chores",
        },
        labelPolicy: "strict",
        nonPrCommitsPolicy: policy,
      },
      github: {
        setup: () => undefined,
        isOwner: ({ nameWithOwner }: { nameWithOwner: string }) =>
          nameWithOwner === "acme/demo",
        batch:
          <O>(queryBuilder: (_: string | number) => string) =>
          async (items: Array<string | number>) => {
            const first = queryBuilder(items[0]);
            if (first.includes("... on Commit")) {
              return commits as O[];
            }
            return prs as O[];
          },
        issue: (n: number) => `https://github.com/acme/demo/issues/${n}`,
        release: async () => ({ data: { number: 1, html_url: "" } }),
      },
      module: {
        version: () => Version.parse("1.0.0"),
        postBump: async () => undefined,
        bump: async () => undefined,
        pkg: (id: string) => `https://npmjs.com/package/${id}`,
      },
      logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
    } as any;
  };

  test("skip policy ignores non-PR commits", async () => {
    const changes = await new FetchApi(buildApi("skip")).changes(Version.parse("1.0.0"));
    expect(changes).toHaveLength(1);
    expect(changes[0].number).toBe(10);
  });

  test("include policy creates synthetic changes for non-PR commits", async () => {
    const changes = await new FetchApi(buildApi("include")).changes(Version.parse("1.0.0"));
    expect(changes).toHaveLength(2);
    expect(changes.find((c) => c.sourceCommit === "def5678")?.title).toContain(
      "standalone commit",
    );
  });

  test("strict-fail policy throws on non-PR commits", async () => {
    await expect(
      new FetchApi(buildApi("strict-fail")).changes(Version.parse("1.0.0")),
    ).rejects.toThrow("without associated PRs");
  });
});
