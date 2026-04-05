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
    expect(parsePRNumberFromCommitMessage("chore: update docs")).toBeUndefined();
  });
});

describe("FetchApi non-PR commit rule", () => {
  const buildApi = (rule: "skip" | "warn" | "error", detectionUse: Array<"labels" | "commits"> = ["labels", "commits"]) => {
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
        title: "feat: From PR",
        body: "",
        author: { login: "dev", url: "https://u/dev" },
        labels: { nodes: [] },
      },
    ];

    const warn = vi.fn();

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
          docs: "Docs",
          test: "Tests",
        },
        policies: {
          labelMode: "strict",
          autoAddInferredPackages: false,
          detectionUse,
          rules: {
            nonPrCommit: rule,
            detectionConflict: "error",
          },
        },
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
      logger: { info: () => undefined, warn, error: () => undefined },
    } as any;
  };

  test("skip ignores non-PR commits", async () => {
    const changes = await new FetchApi(buildApi("skip")).changes(Version.parse("1.0.0"));
    expect(changes).toHaveLength(1);
    expect(changes[0].number).toBe(10);
  });

  test("derives change type from Conventional Commit format when labels are absent", async () => {
    const changes = await new FetchApi(buildApi("skip", ["commits"]))
      .changes(Version.parse("1.0.0"));

    expect(changes[0].type).toBe("feature"); // title: feat: From PR
  });

  test("derives breaking change from Conventional Commit ! marker", async () => {
    const api = buildApi("skip", ["commits"]);
    const originalBatch = api.github.batch;

    api.github.batch =
      <O>(queryBuilder: (_: string | number) => string) =>
      async (items: Array<string | number>) => {
        const first = queryBuilder(items[0]);
        if (first.includes("... on Commit")) {
          return [
            {
              oid: "abc1234",
              message: "feat!: from pr (#10)",
              author: { name: "Dev", user: { login: "dev", url: "https://u/dev" } },
              associatedPullRequests: {
                nodes: [{ number: 10, repository: { nameWithOwner: "acme/demo" } }],
              },
            },
          ] as O[];
        }

        return [
          {
            number: 10,
            title: "feat!: Breaking API change",
            body: "",
            author: { login: "dev", url: "https://u/dev" },
            labels: { nodes: [] },
          },
        ] as O[];
      };

    const changes = await new FetchApi(api).changes(Version.parse("1.0.0"));
    expect(changes[0].type).toBe("breaking");

    api.github.batch = originalBatch;
  });

  test("warn includes synthetic changes for non-PR commits", async () => {
    const changes = await new FetchApi(buildApi("warn")).changes(Version.parse("1.0.0"));
    expect(changes).toHaveLength(2);
    expect(changes.find((c) => c.sourceCommit === "def5678")?.title).toContain(
      "standalone commit",
    );
  });

  test("error throws on non-PR commits", async () => {
    await expect(
      new FetchApi(buildApi("error")).changes(Version.parse("1.0.0")),
    ).rejects.toThrow("without associated PRs");
  });

  test("non-pr rule ignored when commits detection is disabled", async () => {
    const changes = await new FetchApi(buildApi("error", ["labels"]))
      .changes(Version.parse("1.0.0"));

    expect(changes).toHaveLength(1);
  });
});
