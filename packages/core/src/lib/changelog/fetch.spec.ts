import { describe, expect, test, vi } from "vitest";
import {
  FetchApi,
  isReleaseCommit,
  isReleasePr,
  parsePRNumberFromCommitMessage,
} from "./fetch";
import { Version } from "../version";

vi.mock("../git", () => ({
  commitsAfterVersion: vi.fn(() => ["c1", "c2"]),
}));

type DetectionUse = Array<"labels" | "commits">;
type Rule = "skip" | "warn" | "error";

type BuildOptions = {
  nonPrRule?: Rule;
  detectionUse?: DetectionUse;
  detectionConflictRule?: Rule;
  prTitle?: string;
  prBody?: string;
  prLabels?: string[];
  prHeadRefName?: string;
  commits?: any[];
  prCommits?: Array<{ messageHeadline?: string; messageBody?: string }>;
};

const buildApi = (options: BuildOptions = {}) => {
  const {
    nonPrRule = "skip",
    detectionUse = ["labels", "commits"],
    detectionConflictRule = "error",
    prTitle = "feat: From PR",
    prBody = "",
    prLabels = [],
    commits,
    prCommits,
  } = options;

  const commitData = commits ?? [
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
      title: prTitle,
      body: prBody,
      author: { login: "dev", url: "https://u/dev" },
      labels: { nodes: prLabels.map((name) => ({ name })) },
      commits: {
        nodes: (
          prCommits ?? [{ messageHeadline: prTitle, messageBody: prBody }]
        ).map(({ messageHeadline, messageBody }) => ({
          commit: {
            messageHeadline,
            messageBody,
          },
        })),
      },
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
          nonPrCommit: nonPrRule,
          detectionConflict: detectionConflictRule,
          labelConflict: "error",
          inferredPackageMissing: "error",
          versionTagMismatch: "error",
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
            return commitData as O[];
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

describe("release artifact exclusion", () => {
  test("identifies release PR by exact title + release branch", () => {
    expect(
      isReleasePr({
        number: 1,
        title: "Publish Release 1.2.3",
        body: "",
        headRefName: "release-v1.2.3",
        author: { login: "bot", url: "" },
        labels: { nodes: [] },
      }),
    ).toBe(true);

    expect(
      isReleasePr({
        number: 1,
        title: "Publish Release process docs",
        body: "",
        headRefName: "release-v1.2.3",
        author: { login: "bot", url: "" },
        labels: { nodes: [] },
      }),
    ).toBe(false);
  });

  test("identifies release commits by title/merge message", () => {
    expect(
      isReleaseCommit({
        oid: "a",
        message: "Publish Release v1.2.3",
        associatedPullRequests: { nodes: [] },
      } as any),
    ).toBe(true);

    expect(
      isReleaseCommit({
        oid: "b",
        message: "Merge pull request #1 from org/release-v1.2.3",
        associatedPullRequests: { nodes: [] },
      } as any),
    ).toBe(true);

    expect(
      isReleaseCommit({
        oid: "c",
        message: "docs: update release process",
        associatedPullRequests: { nodes: [] },
      } as any),
    ).toBe(false);
  });
});

describe("FetchApi non-PR commit rule", () => {
  test("skip ignores non-PR commits", async () => {
    const changes = await new FetchApi(buildApi({ nonPrRule: "skip" })).changes(
      Version.parse("1.0.0"),
    );
    expect(changes).toHaveLength(1);
    expect(changes[0].number).toBe(10);
  });

  test("warn includes synthetic changes for non-PR commits", async () => {
    const api = buildApi({ nonPrRule: "warn" });
    const changes = await new FetchApi(api).changes(Version.parse("1.0.0"));

    expect(changes).toHaveLength(2);
    expect(changes.find((c) => c.sourceCommit === "def5678")?.title).toContain(
      "standalone commit",
    );
    expect(api.logger.warn).toHaveBeenCalled();
  });

  test("error throws on non-PR commits", async () => {
    await expect(
      new FetchApi(buildApi({ nonPrRule: "error" })).changes(
        Version.parse("1.0.0"),
      ),
    ).rejects.toThrow("without associated PRs");
  });

  test("non-pr rule ignored when commits detection is disabled", async () => {
    const changes = await new FetchApi(
      buildApi({ nonPrRule: "error", detectionUse: ["labels"] }),
    ).changes(Version.parse("1.0.0"));

    expect(changes).toHaveLength(1);
  });
});

describe("FetchApi detection interactions (labels + commits)", () => {
  test("derives change type from Conventional Commit when labels are absent", async () => {
    const changes = await new FetchApi(
      buildApi({ detectionUse: ["commits"], nonPrRule: "skip" }),
    ).changes(Version.parse("1.0.0"));

    expect(changes[0].type).toBe("feature"); // feat:
  });

  test("derives breaking from Conventional Commit ! marker", async () => {
    const changes = await new FetchApi(
      buildApi({
        detectionUse: ["commits"],
        nonPrRule: "skip",
        prTitle: "feat!: Breaking API change",
      }),
    ).changes(Version.parse("1.0.0"));

    expect(changes[0].type).toBe("breaking");
  });

  test("derives breaking from BREAKING CHANGE footer", async () => {
    const changes = await new FetchApi(
      buildApi({
        detectionUse: ["commits"],
        nonPrRule: "skip",
        prTitle: "feat: add endpoint",
        prBody: "Some details\n\nBREAKING CHANGE: remove old endpoint",
      }),
    ).changes(Version.parse("1.0.0"));

    expect(changes[0].type).toBe("breaking");
  });

  test("derives type from PR commit history (not only PR title/body)", async () => {
    const changes = await new FetchApi(
      buildApi({
        detectionUse: ["commits"],
        nonPrRule: "skip",
        prTitle: "chore: update release notes",
        prCommits: [
          { messageHeadline: "fix: patch one" },
          { messageHeadline: "feat: add real capability" },
        ],
      }),
    ).changes(Version.parse("1.0.0"));

    expect(changes[0].type).toBe("feature");
  });

  test("detection conflict throws when rule is error", async () => {
    await expect(
      new FetchApi(
        buildApi({
          detectionUse: ["labels", "commits"],
          detectionConflictRule: "error",
          nonPrRule: "skip",
          prTitle: "fix: patch behavior",
          prLabels: ["✨ feature"],
        }),
      ).changes(Version.parse("1.0.0")),
    ).rejects.toThrow("Detection conflict");
  });

  test("detection conflict warns and follows priority order", async () => {
    const api = buildApi({
      detectionUse: ["labels", "commits"],
      detectionConflictRule: "warn",
      nonPrRule: "skip",
      prTitle: "fix: patch behavior",
      prLabels: ["✨ feature"],
    });

    const changes = await new FetchApi(api).changes(Version.parse("1.0.0"));

    expect(api.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Detection conflict"),
    );
    expect(changes[0].type).toBe("feature"); // labels first
  });

  test("detection conflict skip does not warn and follows priority order", async () => {
    const api = buildApi({
      detectionUse: ["commits", "labels"],
      detectionConflictRule: "skip",
      nonPrRule: "skip",
      prTitle: "fix: patch behavior",
      prLabels: ["✨ feature"],
    });

    const changes = await new FetchApi(api).changes(Version.parse("1.0.0"));

    expect(api.logger.warn).not.toHaveBeenCalled();
    expect(changes[0].type).toBe("fix"); // commits first
  });
});
