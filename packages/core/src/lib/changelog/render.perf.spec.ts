import { describe, expect, test, vi } from "vitest";
import { RenderAPI } from "./render";
import type { Api, Change } from "./types";
import { Version } from "../version";

vi.mock("../git", () => ({
  getDate: () => "2026-04-05",
}));

const api: Api = {
  config: {
    gh: "acme/demo",
    pkgs: { core: { name: "@acme/core" } },
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
    changelog: { grouping: "package" },
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

describe("RenderAPI scalability baseline", () => {
  test("renders a large changelog fixture", () => {
    const changes: Change[] = Array.from({ length: 500 }).map((_, i) => ({
      number: i + 1,
      title: `Change ${i + 1}`,
      body: i % 10 === 0 ? "Multiline\nbody" : "",
      author: { login: `dev${i % 5}`, url: `https://example.com/dev${i % 5}` },
      labels: { nodes: [] },
      type: i % 7 === 0 ? "feature" : i % 5 === 0 ? "fix" : "chore",
      pkgs: i % 2 === 0 ? ["core"] : [],
    }));

    const start = Date.now();
    const out = new RenderAPI(api).changes(Version.parse("9.9.9"), changes);
    const elapsedMs = Date.now() - start;

    expect(out.length).toBeGreaterThan(1000);
    // broad ceiling to avoid flakes while still catching extreme regressions
    expect(elapsedMs).toBeLessThan(2000);
  });
});
