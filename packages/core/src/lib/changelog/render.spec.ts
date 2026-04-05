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
    policies: {
      labelMode: "strict",
      autoAddInferredPackages: false,
      detectionUse: ["labels"],
      rules: {
        labelConflict: "error",
        inferredPackageMissing: "error",
        detectionConflict: "error",
        nonPrCommit: "skip",
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
  test("template + package grouping + multiline body", () => {
    const api = baseApi({
      templates: {
        header: "## Release {{VERSION}} on {{DATE}}",
      },
      grouping: "package",
    });

    const changes: Change[] = [
      c({
        number: 1,
        title: "Add dark mode",
        body: "Detailed note\nSecond line",
        author: { login: "alice", url: "https://example.com/alice" },
        type: "feature",
        pkgs: ["core"],
      }),
      c({
        number: 2,
        title: "Fix login",
        author: { login: "bob", url: "https://example.com/bob" },
        type: "fix",
        pkgs: ["cli"],
      }),
      c({
        number: 3,
        title: "Minor cleanup",
        author: { login: "chris", url: "https://example.com/chris" },
        type: "chore",
        pkgs: [],
      }),
    ];

    const markdown = new RenderAPI(api).changes(
      Version.parse("1.2.3"),
      changes,
    );
    expect(markdown).toMatchSnapshot();
  });

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

  test("custom section/item templates", () => {
    const api = baseApi({
      templates: {
        section: "### {{LABEL}}\n{{CHANGES}}",
        item: "- {{REF}} | {{TITLE}} | {{AUTHOR}} | {{PACKAGES}}",
      },
      grouping: "scope",
    });

    const markdown = new RenderAPI(api).changes(Version.parse("4.0.0"), [
      c({
        number: 40,
        type: "feature",
        title: "Template driven entry",
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
});
