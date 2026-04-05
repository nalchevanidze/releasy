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

  test("keeps explicit configVersion", () => {
    const out = normalizeConfig(
      {
        configVersion: 1,
        pkgs: { core: "@acme/core" },
        project: { type: "npm" },
      },
      "acme/demo",
    );

    expect(out.configVersion).toBe(1);
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
