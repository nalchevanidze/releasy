import { describe, expect, test } from "vitest";
import {
  loadRawConfig,
  normalizeConfig,
  normalizeConfigInputKeys,
} from "./load";

describe("config normalization", () => {
  test("defaults policy fields", () => {
    const out = normalizeConfig(
      {
        pkgs: { core: "@acme/core" },
        project: { type: "npm" },
      },
      "acme/demo",
    );

    expect(out.policies.labelMode).toBe("strict");
    expect(out.policies.detectionUse).toEqual(["labels"]);
    expect(out.policies.rules.nonPrCommit).toBe("skip");
    expect(out.policies.rules.versionTagMismatch).toBe("error");
    expect(out.changelog.noChangesMessage).toBe(
      "No user-facing changes since the last tag.",
    );
    expect(out.changelog.untitledChangeMessage).toBe("Untitled change");
  });

  test("normalizes kebab-case keys and single-string paths", () => {
    const normalized = normalizeConfigInputKeys({
      pkgs: {
        core: { name: "@acme/core", paths: "packages/core/**" },
      },
      project: { type: "npm", "base-branch": "main" },
      policies: {
        "label-mode": "strict",
        "detection-use": ["labels"],
      },
      changelog: {
        "no-changes-message": "Nothing to ship",
        "untitled-change-message": "No title",
      },
    }) as any;

    expect(normalized.project.baseBranch).toBe("main");

    const out = normalizeConfig(normalized, "acme/demo");
    expect(out.pkgs.core.paths).toEqual(["packages/core/**"]);
    expect(out.changelog?.noChangesMessage).toBe("Nothing to ship");
    expect(out.changelog?.untitledChangeMessage).toBe("No title");
  });

  test("derives change titles/icons/bumps/scopes from changes map", () => {
    const out = normalizeConfig(
      {
        pkgs: { core: "@acme/core" },
        project: { type: "npm" },
        changes: {
          docs: {
            title: "Documentation",
            icon: "📚",
            bump: "patch",
            paths: "docs/**/*.md",
          },
        },
      },
      "acme/demo",
    );

    expect(out.changeTypes.docs).toBe("Documentation");
    expect(out.changeTypeEmojis?.docs).toBe("📚");
    expect(out.changeTypeBumps?.docs).toBe("patch");
    expect(out.changeTypeScopes?.docs.paths).toEqual(["docs/**/*.md"]);
  });

  test("throws on duplicate semantic keys after normalization", () => {
    expect(() =>
      normalizeConfigInputKeys({
        policies: {
          "label-mode": "strict",
          labelMode: "permissive",
        },
      }),
    ).toThrow("Duplicate semantic key");
  });
});

describe("config file loading", () => {
  test("loads relasy.yaml successfully via injected filesystem deps", async () => {
    const cfg = await loadRawConfig({
      exists: async (path) => path === "./relasy.yaml",
      readTextFile: async () =>
        [
          "pkgs:",
          "  core:",
          "    name: '@acme/core'",
          "project:",
          "  type: npm",
        ].join("\n"),
    });

    expect(cfg.project.type).toBe("npm");
    expect((cfg.pkgs as any).core.name ?? (cfg.pkgs as any).core).toBe(
      "@acme/core",
    );
  });

  test("rejects relasy.json-only behavior by requiring YAML paths", async () => {
    await expect(
      loadRawConfig({
        exists: async () => false,
      }),
    ).rejects.toThrow(
      "Missing configuration file. Expected relasy.yaml or relasy.yml.",
    );
  });
});
