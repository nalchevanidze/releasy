import { describe, expect, test, vi } from "vitest";
import { RenderAPI } from "./render";
import type { Api, Change } from "./types";
import { Version } from "../version";

vi.mock("../git", () => ({
  getDate: () => "2026-04-05",
}));

const changes: Change[] = [
  {
    number: 1,
    title: "Add dark mode",
    body: "Detailed note",
    author: { login: "alice", url: "https://example.com/alice" },
    labels: { nodes: [] },
    type: "feature",
    pkgs: ["core"],
  },
  {
    number: 2,
    title: "Fix login",
    body: "",
    author: { login: "bob", url: "https://example.com/bob" },
    labels: { nodes: [] },
    type: "fix",
    pkgs: ["cli"],
  },
];

const api: Api = {
  config: {
    gh: "acme/demo",
    pkgs: { core: "@acme/core", cli: "@acme/cli" },
    project: { type: "npm" },
    changeTypes: {
      breaking: "Breaking",
      feature: "Features",
      fix: "Fixes",
      chore: "Chores",
    },
    labelPolicy: "strict",
    changelog: {
      headerTemplate: "## Release {{VERSION}} on {{DATE}}",
      groupByPackage: true,
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
};

describe("RenderAPI snapshots", () => {
  test("renders changelog with template and package grouping", () => {
    const markdown = new RenderAPI(api).changes(Version.parse("1.2.3"), changes);

    expect(markdown).toMatchSnapshot();
  });
});
