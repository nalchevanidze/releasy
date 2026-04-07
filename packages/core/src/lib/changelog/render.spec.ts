import { describe, expect, test, vi } from "vitest";
import { RenderAPI } from "./render";
import type { Api, Change } from "./types";
import { Version } from "../version";

vi.mock("../git", () => ({
  getDate: () => "2026-04-05",
}));

const baseApi = (changelog?: Api["config"]["changelog"]): Api => ({
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
    changelog,
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

describe("RenderAPI snapshots", () => {
  test("default header + scope grouping", () => {
    const api = baseApi({
      grouping: "scope",
    });

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

    const markdown = new RenderAPI(api).changes(
      Version.parse("2.0.0"),
      changes,
    );
    expect(markdown).toMatchSnapshot();
  });

  test("large mixed release snapshot", () => {
    const api = baseApi({
      grouping: "package",
    });

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

    const markdown = new RenderAPI(api).changes(
      Version.parse("3.4.0"),
      changes,
    );
    expect(markdown).toMatchSnapshot();
  });

  test("package grouping normalizes multi-package keys", () => {
    const api = baseApi({
      grouping: "package",
    });

    const markdown = new RenderAPI(api).changes(Version.parse("3.4.1"), [
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
    ]);

    expect(markdown).toMatchSnapshot();
  });

  test("grouping none renders a flat list without sections", () => {
    const api = baseApi({
      grouping: "none",
    });

    const markdown = new RenderAPI(api).changes(Version.parse("4.0.1"), [
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
    ]);

    expect(markdown).toMatchSnapshot();
  });

  test("package grouping renders normalized multi-package sections", () => {
    const api = baseApi({
      grouping: "package",
    });

    const markdown = new RenderAPI(api).changes(Version.parse("4.0.2"), [
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
    ]);

    expect(markdown).toMatchSnapshot();
  });

  test("unknown package labels fall back to raw names with links when available", () => {
    const api = baseApi({
      grouping: "scope",
    });

    const markdown = new RenderAPI(api).changes(Version.parse("4.0.3"), [
      c({
        number: 54,
        type: "feature",
        title: "Wire analytics hook",
        pkgs: ["sdk"],
      }),
    ]);

    expect(markdown).toMatchSnapshot();
  });

  test("empty change list renders a friendly empty-state note", () => {
    const api = baseApi({
      grouping: "scope",
    });

    const markdown = new RenderAPI(api).changes(Version.parse("4.0.5"), []);

    expect(markdown).toMatchSnapshot();
  });

  test("default layout renders top-level visual summary", () => {
    const api = baseApi({
      grouping: "scope",
    });

    const markdown = new RenderAPI(api).changes(Version.parse("4.0.7"), [
      c({
        number: 57,
        type: "feature",
        title: "Ship composer",
        pkgs: ["core"],
      }),
      c({ number: 58, type: "feature", title: "Ship presets", pkgs: ["web"] }),
      c({ number: 59, type: "fix", title: "Fix lint script", pkgs: ["cli"] }),
    ]);

    expect(markdown).toMatchSnapshot();
  });

  test("section icons come from user config changeTypeEmojis", () => {
    const api = baseApi({
      grouping: "scope",
    });

    api.config.changeTypeEmojis = {
      ...api.config.changeTypeEmojis,
      feature: "🚀",
      fix: "🛠️",
    };

    const markdown = new RenderAPI(api).changes(Version.parse("4.0.9"), [
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
    ]);

    expect(markdown).toMatchSnapshot();
  });

  test("commit-only synthetic entries (sourceCommit + no author url)", () => {
    const api = baseApi();

    const markdown = new RenderAPI(api).changes(Version.parse("4.1.0"), [
      c({
        number: 0,
        sourceCommit: "abcdef1234567890",
        title: "Standalone commit",
        body: "raw commit body",
        author: { login: "ci-bot", url: "" },
        type: "chore",
        pkgs: [],
      }),
    ]);

    expect(markdown).toMatchSnapshot();
  });

  test("filters generated release PR refinements (with and without v prefix)", () => {
    const api = baseApi({ grouping: "scope" });

    const markdown = new RenderAPI(api).changes(Version.parse("4.1.1"), [
      c({
        number: 71,
        isRefinement: true,
        title: "Publish Release 0.2.1",
        body: "# 🚀 v0.2.1",
      }),
      c({
        number: 72,
        isRefinement: true,
        title: "Publish Release v0.2.2",
        body: "# 🚀 v0.2.2",
      }),
      c({
        number: 0,
        sourceCommit: "1234567890abcdef",
        isRefinement: true,
        title: "internal cleanup",
        body: "n/a",
      }),
    ]);

    expect(markdown).not.toContain("Publish Release 0.2.1");
    expect(markdown).not.toContain("Publish Release v0.2.2");
    expect(markdown).toContain("### 🧹 CHORES");
    expect(markdown).toContain(
      "* **UNK** — commits missing Conventional Commit format or an associated PR",
    );
    expect(markdown).toContain(
      "[1234567](https://github.com/acme/demo/commit/1234567890abcdef)",
    );
    expect(markdown).toContain("internal cleanup");
  });

  test("filters refinement when relasy release marker is present", () => {
    const api = baseApi({ grouping: "scope" });

    const markdown = new RenderAPI(api).changes(Version.parse("4.1.2"), [
      c({
        number: 73,
        isRefinement: true,
        title: "Some unrelated title",
        body: "notes\n\n<!-- relasy:release-pr -->",
      }),
    ]);

    expect(markdown).not.toContain("Some unrelated title");
  });

  test("does not filter non-generated refinements", () => {
    const api = baseApi({ grouping: "scope" });

    const markdown = new RenderAPI(api).changes(Version.parse("4.1.3"), [
      c({
        number: 74,
        isRefinement: true,
        title: "Publish Release process docs",
        body: "# docs",
      }),
    ]);

    expect(markdown).toContain("Publish Release process docs");
  });

  test("preserves repeated spaces in rendered titles", () => {
    const api = baseApi({ grouping: "scope" });

    const markdown = new RenderAPI(api).changes(Version.parse("4.1.5"), [
      c({
        number: 75,
        type: "feature",
        title: "Ship  presets",
        pkgs: ["web"],
      }),
      c({
        number: 0,
        sourceCommit: "feedfacecafebeef",
        isRefinement: true,
        type: "chore",
        title: "internal  cleanup",
        pkgs: [],
      }),
    ]);

    expect(markdown).toContain("Ship  presets");
    expect(markdown).toContain("internal  cleanup");
  });

  test("caps internal changes list and collapses overflow in details", () => {
    const api = baseApi({ grouping: "scope" });

    const refinements = Array.from({ length: 10 }).map((_, i) =>
      c({
        number: 0,
        sourceCommit: `${String(i).repeat(8)}abcdef1234567890`,
        isRefinement: true,
        title: `internal ${i}`,
      }),
    );

    const markdown = new RenderAPI(api).changes(
      Version.parse("4.1.4"),
      refinements,
    );

    expect(markdown).toContain("### 🧹 CHORES");
    expect(markdown).toContain(
      "* **UNK** — commits missing Conventional Commit format or an associated PR",
    );
    expect(markdown).toContain("internal 0");
    expect(markdown).toContain("internal 4");
    expect(markdown).toContain("&nbsp; └ +5 more");
    expect(markdown).not.toContain("internal 9");
  });
});
