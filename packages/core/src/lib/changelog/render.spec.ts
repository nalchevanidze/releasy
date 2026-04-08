import { describe, expect, test } from "vitest";
import { Changelog } from "./index";
import type { Api, Change } from "./types";
import { Version } from "../version";

const releaseDate = new Date("2026-04-05T00:00:00Z");

const baseApi = (): Api => ({
  config: {
    gh: "acme/demo",
    pkgs: {
      core: { name: "@acme/core" },
      cli: { name: "@acme/cli" },
      web: { name: "@acme/web" },
    },
    project: { type: "npm" },
    changeTypes: {
      breaking: "Breaking",
      feature: "Features",
      fix: "Fixes",
      chore: "Chores",
      docs: "Documentation",
      test: "Testing",
    },
    changeTypeEmojis: {
      breaking: "💥",
      feature: "✨",
      fix: "🐛",
      chore: "🧹",
      docs: "📚",
      test: "🧪",
    },
    policies: {
      labelMode: "strict",
      autoAddInferredPackages: false,
      detectionUse: ["labels"],
      rules: {
        labelConflict: "error",
        inferredPackageMissing: "error",
        detectionConflict: "error",
        nonPrCommit: "skip",
        versionTagMismatch: "error",
      },
    },
    changelog: {
      noChangesMessage: "No user-facing changes since the last tag.",
      untitledChangeMessage: "Untitled change",
    },
  },
  github: {
    setup: () => undefined,
    isOwner: () => true,
    batch: () => async () => [],
    issue: (n: number) => `https://github.com/acme/demo/issues/${n}`,
    release: async () => ({ data: { number: 1, html_url: "" } }),
  },
  module: {
    version: () => Version.parse("1.0.0"),
    postBump: async () => undefined,
    bump: async () => undefined,
    pkg: (id: string) => `https://npmjs.com/package/${id}`,
  },
  logger: {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  },
});

const c = (overrides: Partial<Change>): Change => ({
  number: 1,
  title: "placeholder",
  body: "",
  author: { login: "author", url: "https://example.com/author" },
  labels: { nodes: [] },
  type: "chore",
  pkgs: ["core"],
  ...overrides,
});

const renderSingle = (
  api: Api,
  tag: Version,
  changes: Change[],
  options: { releaseDate: Date; previousVersion?: Version },
) => new Changelog(api).documents([{ tag, changes, ...options }]);

describe("RenderAPI snapshots", () => {
  test("default header", () => {
    const api = baseApi();
    const changes: Change[] = [
      c({
        number: 10,
        title: "Ship onboarding",
        type: "feature",
        pkgs: ["web", "core"],
      }),
      c({
        number: 11,
        title: "Fix race condition",
        type: "fix",
        pkgs: ["core"],
      }),
    ];

    const markdown = renderSingle(api, Version.parse("2.0.0"), changes, {
      releaseDate,
      previousVersion: Version.parse("1.9.0"),
    });
    expect(markdown).toMatchSnapshot();
  });

  test("large mixed release snapshot", () => {
    const api = baseApi();
    const changes: Change[] = [
      c({
        number: 20,
        title: "Drop legacy auth",
        type: "breaking",
        pkgs: ["core"],
      }),
      c({
        number: 21,
        title: "Add cache layer",
        type: "feature",
        pkgs: ["core"],
      }),
      c({ number: 22, title: "Add dashboard", type: "feature", pkgs: ["web"] }),
      c({ number: 23, title: "Fix pagination", type: "fix", pkgs: ["web"] }),
      c({ number: 24, title: "Fix typo", type: "fix", pkgs: [] }),
      c({ number: 25, title: "Bump deps", type: "chore", pkgs: ["cli"] }),
      c({ number: 26, title: "Refactor scripts", type: "chore", pkgs: [] }),
    ];

    const markdown = renderSingle(api, Version.parse("3.4.0"), changes, {
      releaseDate,
      previousVersion: Version.parse("2.9.0"),
    });
    expect(markdown).toMatchSnapshot();
  });

  test("multi-package metadata is normalized", () => {
    const api = baseApi();

    const markdown = renderSingle(
      api,
      Version.parse("3.4.1"),
      [
        c({
          number: 30,
          type: "feature",
          title: "Ship shared auth layer",
          pkgs: ["web", "core"],
        }),
        c({
          number: 31,
          type: "feature",
          title: "Expand auth docs",
          pkgs: ["core", "web"],
        }),
      ],
      {
        releaseDate,
        previousVersion: Version.parse("3.3.0"),
      },
    );

    expect(markdown).toMatchSnapshot();
  });

  test("renders sectioned list", () => {
    const api = baseApi();

    const markdown = renderSingle(
      api,
      Version.parse("4.0.1"),
      [
        c({
          number: 50,
          type: "feature",
          title: "Add keyboard shortcuts",
          pkgs: ["web"],
        }),
        c({
          number: 51,
          type: "fix",
          title: "Handle null session",
          pkgs: ["core"],
        }),
      ],
      {
        releaseDate,
        previousVersion: Version.parse("4.0.0"),
      },
    );

    expect(markdown).toMatchSnapshot();
  });

  test("keeps multi-package metadata stable", () => {
    const api = baseApi();

    const markdown = renderSingle(
      api,
      Version.parse("4.0.2"),
      [
        c({
          number: 52,
          type: "fix",
          title: "Align package order",
          pkgs: ["web", "core", "web"],
        }),
        c({
          number: 53,
          type: "fix",
          title: "Keep grouping stable",
          pkgs: ["core", "web"],
        }),
      ],
      { releaseDate },
    );

    expect(markdown).toMatchSnapshot();
  });

  test("unknown package labels fall back to raw names with links when available", () => {
    const api = baseApi();

    const markdown = renderSingle(
      api,
      Version.parse("4.0.3"),
      [
        c({
          number: 54,
          type: "feature",
          title: "Wire analytics hook",
          pkgs: ["sdk"],
        }),
      ],
      {
        releaseDate,
        previousVersion: Version.parse("4.0.2"),
      },
    );

    expect(markdown).toMatchSnapshot();
  });

  test("empty change list renders a friendly empty-state note", () => {
    const api = baseApi();

    const markdown = renderSingle(api, Version.parse("4.0.5"), [], {
      releaseDate,
    });

    expect(markdown).toMatchSnapshot();
  });

  test("empty-state message can be configured via changelog.no-changes-message", () => {
    const api = baseApi();
    api.config.changelog = {
      noChangesMessage: "Nothing changed.",
      untitledChangeMessage: "Untitled change",
    };

    const markdown = renderSingle(api, Version.parse("4.0.6"), [], {
      releaseDate,
    });

    expect(markdown).toContain("Nothing changed.");
  });

  test("default layout renders top-level visual summary", () => {
    const api = baseApi();

    const markdown = renderSingle(
      api,
      Version.parse("4.0.7"),
      [
        c({
          number: 57,
          type: "feature",
          title: "Ship composer",
          pkgs: ["core"],
        }),
        c({
          number: 58,
          type: "feature",
          title: "Ship presets",
          pkgs: ["web"],
        }),
        c({ number: 59, type: "fix", title: "Fix lint script", pkgs: ["cli"] }),
      ],
      {
        releaseDate,
        previousVersion: Version.parse("4.0.6"),
      },
    );

    expect(markdown).toMatchSnapshot();
  });

  test("section icons come from user config changeTypeEmojis", () => {
    const api = baseApi();
    api.config.changeTypeEmojis = {
      ...api.config.changeTypeEmojis,
      feature: "🚀",
      fix: "🛠️",
    };

    const markdown = renderSingle(
      api,
      Version.parse("4.0.9"),
      [
        c({
          number: 61,
          type: "feature",
          title: "Ship inline editor",
          pkgs: ["web"],
        }),
        c({
          number: 62,
          type: "fix",
          title: "Handle stale cache",
          pkgs: ["core"],
        }),
      ],
      {
        releaseDate,
        previousVersion: Version.parse("4.0.8"),
      },
    );

    expect(markdown).toMatchSnapshot();
  });

  test("commit-only synthetic entries (sourceCommit + no author url)", () => {
    const api = baseApi();

    const markdown = renderSingle(
      api,
      Version.parse("4.1.0"),
      [
        c({
          number: 0,
          sourceCommit: "abcdef1234567890",
          title: "Standalone commit",
          body: "raw commit body",
          author: { login: "ci-bot", url: "" },
          type: "chore",
          pkgs: [],
        }),
      ],
      { releaseDate },
    );

    expect(markdown).toMatchSnapshot();
  });

  test("uses changelog untitled message for blank titles", () => {
    const api = baseApi();
    api.config.changelog.untitledChangeMessage = "No title provided";

    const markdown = renderSingle(
      api,
      Version.parse("4.1.5"),
      [c({ number: 75, type: "feature", title: "   ", pkgs: ["web"] })],
      { releaseDate },
    );

    expect(markdown).toContain("No title provided");
  });

  test("preserves repeated spaces in rendered titles", () => {
    const api = baseApi();

    const markdown = renderSingle(
      api,
      Version.parse("4.1.5"),
      [
        c({
          number: 75,
          type: "feature",
          title: "Ship  presets",
          pkgs: ["web"],
        }),
        c({
          number: 0,
          sourceCommit: "feedfacecafebeef",
          type: "chore",
          title: "internal  cleanup",
          pkgs: [],
        }),
      ],
      { releaseDate },
    );

    expect(markdown).toContain("Ship  presets");
    expect(markdown).toContain("internal  cleanup");
  });

  test("renders uncategorized commit entries under chores", () => {
    const api = baseApi();

    const uncategorizedCommits = Array.from({ length: 10 }).map((_, i) =>
      c({
        number: 0,
        sourceCommit: `${String(i).repeat(8)}abcdef1234567890`,
        type: "chore",
        isRefinement: true,
        title: `internal ${i}`,
        pkgs: [],
      }),
    );

    const markdown = renderSingle(
      api,
      Version.parse("4.1.4"),
      uncategorizedCommits,
      { releaseDate },
    );

    expect(markdown).toContain("### 🧹 CHORES");
    expect(markdown).toContain("internal 0");
    expect(markdown).toContain("internal 9");
  });
});
