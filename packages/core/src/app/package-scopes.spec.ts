import { describe, expect, test, vi } from "vitest";
import { evaluatePackageScopeRules } from "./package-scopes";

const buildIRelasy = (rules?: {
  inferredPackageMissing?: "skip" | "warn" | "error";
  labelConflict?: "skip" | "warn" | "error";
}) => {
  const warn = vi.fn();

  return {
    iRelasy: {
      config: {
        pkgs: {
          core: { name: "@acme/core", paths: ["packages/core/**"] },
          cli: { name: "@acme/cli", paths: ["packages/cli/**"] },
        },
        policies: {
          rules: {
            inferredPackageMissing: rules?.inferredPackageMissing ?? "error",
            labelConflict: rules?.labelConflict ?? "error",
          },
        },
      },
      logger: { warn },
      parseLabels: (labels: string[]) => ({
        changeTypes: [],
        pkgs: labels
          .filter((l) => l.startsWith("📦 "))
          .map((l) => ({ pkg: l.replace("📦 ", "") })),
      }),
    },
    warn,
  };
};

describe("package scope rules", () => {
  test("passes when inferred scope labels exist", () => {
    const { iRelasy } = buildIRelasy();
    const out = evaluatePackageScopeRules(
      iRelasy as any,
      ["📦 core"],
      ["packages/core/src/index.ts"],
    );

    expect(out.ok).toBe(true);
  });

  test("infers multiple scopes from changed paths", () => {
    const { iRelasy } = buildIRelasy();
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
    const { iRelasy } = buildIRelasy();
    const out = evaluatePackageScopeRules(iRelasy as any, [], ["docs/readme.md"]);

    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.data.inferredScopes).toEqual([]);
    }
  });

  test("fails when inferred labels are missing", () => {
    const { iRelasy } = buildIRelasy({ inferredPackageMissing: "error" });
    const out = evaluatePackageScopeRules(
      iRelasy as any,
      [],
      ["packages/core/src/index.ts"],
    );

    expect(out.ok).toBe(false);
  });

  test("warns when inferred labels are missing and warn rule is enabled", () => {
    const { iRelasy, warn } = buildIRelasy({ inferredPackageMissing: "warn" });
    const out = evaluatePackageScopeRules(
      iRelasy as any,
      [],
      ["packages/core/src/index.ts"],
    );

    expect(out.ok).toBe(true);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Missing inferred package labels"),
    );
  });

  test("fails on conflicting labels when rule enabled", () => {
    const { iRelasy } = buildIRelasy({
      inferredPackageMissing: "skip",
      labelConflict: "error",
    });

    const out = evaluatePackageScopeRules(
      iRelasy as any,
      ["📦 cli"],
      ["packages/core/src/index.ts"],
    );

    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.message).toContain("conflict");
    }
  });

  test("warns on conflicting labels when warn rule is enabled", () => {
    const { iRelasy, warn } = buildIRelasy({
      inferredPackageMissing: "skip",
      labelConflict: "warn",
    });

    const out = evaluatePackageScopeRules(
      iRelasy as any,
      ["📦 cli"],
      ["packages/core/src/index.ts"],
    );

    expect(out.ok).toBe(true);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Package label conflict detected"),
    );
  });
});
