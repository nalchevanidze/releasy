import { describe, expect, test } from "vitest";
import {
  loadRawConfig,
  normalizeConfig,
  normalizeConfigInputKeys,
  validateChangelogTemplates,
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
    }) as any;

    expect(normalized.project.baseBranch).toBe("main");

    const out = normalizeConfig(normalized, "acme/demo");
    expect(out.pkgs.core.paths).toEqual(["packages/core/**"]);
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
  test("loader implementation no longer references relasy.json", () => {
    const source = loadRawConfig.toString();

    expect(source).toContain("relasy.yaml");
    expect(source).toContain("relasy.yml");
    expect(source).not.toContain("relasy.json");
  });

  test("missing config error mentions yaml-only paths", () => {
    const source = loadRawConfig.toString();

    expect(source).toContain(
      "Missing configuration file. Expected relasy.yaml or relasy.yml.",
    );
  });
});

describe("template guardrails", () => {
  test("accepts valid templates", () => {
    expect(() =>
      validateChangelogTemplates({
        templates: {
          header: "## {{VERSION}} ({{DATE}})",
          section: "#### {{LABEL}}\n{{CHANGES}}",
          item: "* {{REF}} {{TITLE}} {{AUTHOR}} {{PACKAGES}}",
        },
      }),
    ).not.toThrow();
  });

  test("rejects missing required placeholders", () => {
    expect(() =>
      validateChangelogTemplates({
        templates: {
          section: "#### {{LABEL}}",
        },
      }),
    ).toThrow("missing required placeholders");
  });

  test("rejects unknown placeholders", () => {
    expect(() =>
      validateChangelogTemplates({
        templates: {
          item: "* {{REF}} {{TITLE}} {{WHATEVER}}",
        },
      }),
    ).toThrow("unknown placeholders");
  });
});
