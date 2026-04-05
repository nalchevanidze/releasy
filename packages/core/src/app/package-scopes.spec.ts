import { describe, expect, test } from "vitest";
import { evaluatePackageScopeRules } from "./package-scopes";

const iRelasy = {
  config: {
    pkgs: {
      core: { name: "@acme/core", paths: ["packages/core/**"] },
      cli: { name: "@acme/cli", paths: ["packages/cli/**"] },
    },
    policies: {
      rules: {
        inferredPackageMissing: "error",
        labelConflict: "error",
      },
    },
  },
  parseLabels: (labels: string[]) => ({
    changeTypes: [],
    pkgs: labels
      .filter((l) => l.startsWith("📦 "))
      .map((l) => ({ pkg: l.replace("📦 ", "") })),
  }),
};

describe("package scope rules", () => {
  test("passes when inferred scope labels exist", () => {
    const out = evaluatePackageScopeRules(
      iRelasy as any,
      ["📦 core"],
      ["packages/core/src/index.ts"],
    );

    expect(out.ok).toBe(true);
  });

  test("infers multiple scopes from changed paths", () => {
    const out = evaluatePackageScopeRules(
      iRelasy as any,
      ["📦 core", "📦 cli"],
      ["packages/core/src/index.ts", "packages/cli/src/index.ts"],
    );

    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.data.inferredScopes.sort()).toEqual(["cli", "core"]);
    }
  });

  test("no-match paths produce no inferred scopes", () => {
    const out = evaluatePackageScopeRules(
      iRelasy as any,
      [],
      ["docs/readme.md"],
    );

    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.data.inferredScopes).toEqual([]);
    }
  });

  test("fails when inferred labels are missing", () => {
    const out = evaluatePackageScopeRules(
      iRelasy as any,
      [],
      ["packages/core/src/index.ts"],
    );

    expect(out.ok).toBe(false);
  });

  test("fails on conflicting labels when rule enabled", () => {
    const iRelasyConflict = {
      ...iRelasy,
      config: {
        ...iRelasy.config,
        policies: {
          rules: {
            inferredPackageMissing: "skip",
            labelConflict: "error",
          },
        },
      },
    };

    const out = evaluatePackageScopeRules(
      iRelasyConflict as any,
      ["📦 cli"],
      ["packages/core/src/index.ts"],
    );

    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.message).toContain("conflict");
    }
  });
});
