import { describe, expect, test } from "vitest";
import { normalizeConfig, validateChangelogTemplates } from "./load";

describe("config normalization/versioning", () => {
  test("defaults configVersion and policies for legacy shape", () => {
    const out = normalizeConfig(
      {
        pkgs: { core: "@acme/core" },
        project: { type: "npm" },
      },
      "acme/demo",
    );

    expect(out.configVersion).toBe(1);
    expect(out.labelPolicy).toBe("strict");
    expect(out.nonPrCommitsPolicy).toBe("skip");
  });

  test("normalizes single-string pkg paths into lists", () => {
    const out = normalizeConfig(
      {
        pkgs: {
          core: { name: "@acme/core", paths: "packages/core/**" },
        },
        project: { type: "npm" },
      },
      "acme/demo",
    );

    expect(out.pkgs.core.paths).toEqual(["packages/core/**"]);
  });

  test("derives change titles/icons/scopes from changes map", () => {
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

  test("requires bump when custom change entry is declared", () => {
    expect(() =>
      normalizeConfig(
        {
          pkgs: { core: "@acme/core" },
          project: { type: "npm" },
          changes: {
            docs: {
              title: "Documentation",
              icon: "📚",
            },
          },
        },
        "acme/demo",
      ),
    ).toThrow("changes.docs.bump is required");
  });
});

describe("template guardrails", () => {
  test("accepts valid templates", () => {
    expect(() =>
      validateChangelogTemplates({
        headerTemplate: "## {{VERSION}} ({{DATE}})",
        sectionTemplate: "#### {{LABEL}}\n{{CHANGES}}",
        itemTemplate: "* {{REF}} {{TITLE}} {{AUTHOR}} {{PACKAGES}}",
      }),
    ).not.toThrow();
  });

  test("rejects missing required placeholders", () => {
    expect(() =>
      validateChangelogTemplates({
        sectionTemplate: "#### {{LABEL}}",
      }),
    ).toThrow("missing required placeholders");
  });

  test("rejects unknown placeholders", () => {
    expect(() =>
      validateChangelogTemplates({
        itemTemplate: "* {{REF}} {{TITLE}} {{WHATEVER}}",
      }),
    ).toThrow("unknown placeholders");
  });
});
