import { test, expect, describe } from "vitest";
import { parseLabel } from "./parse";

describe("parseLabel", () => {
  const mockConfig = {
    changeTypes: {
      major: "Major Change",
      breaking: "Breaking Change",
      feature: "Feature",
      fix: "Bug Fix",
      chore: "Chore",
    },
    pkgs: {
      core: "Core Module",
      cli: "Command Line Interface",
      docs: "Documentation",
      api: "API Changes",
    },
    gh: "mock-gh",
    project: { type: "npm" as const },
  };

  describe("changeTypes parsing", () => {
    test("parses simple change type label", () => {
      const label = parseLabel(mockConfig, "feature");
      expect(label).toMatchInlineSnapshot(`
         {
           "changeType": "feature",
           "color": "0E8A16",
           "description": "Label for versioning: Feature",
           "existing": "feature",
           "name": "✨ feature",
           "type": "changeTypes",
         }
       `);
    });

    test("parses fix change type with correct color", () => {
      const label = parseLabel(mockConfig, "fix");
      expect(label).toMatchInlineSnapshot(`
        {
          "changeType": "fix",
          "color": "FFFFFF",
          "description": "Label for versioning: Bug Fix",
          "existing": "fix",
          "name": "🐛 fix",
          "type": "changeTypes",
        }
      `);
    });

    test("parses major change type with red color", () => {
      const label = parseLabel(mockConfig, "major");
      expect(label).toMatchInlineSnapshot(`
        {
          "changeType": "major",
          "color": "B60205",
          "description": "Label for versioning: Major Change",
          "existing": "major",
          "name": "🚨 major",
          "type": "changeTypes",
        }
      `);
    });

    test("parses breaking change type with red color", () => {
      const label = parseLabel(mockConfig, "breaking");
      expect(label).toMatchInlineSnapshot(`
        {
          "changeType": "breaking",
          "color": "FBCA04",
          "description": "Label for versioning: Breaking Change",
          "existing": "breaking",
          "name": "💥 breaking",
          "type": "changeTypes",
        }
      `);
    });

    test("parses chore with light gray color", () => {
      const label = parseLabel(mockConfig, "chore");
      expect(label).toMatchInlineSnapshot(`
        {
          "changeType": "chore",
          "color": "FFFFFF",
          "description": "Label for versioning: Chore",
          "existing": "chore",
          "name": "🧹 chore",
          "type": "changeTypes",
        }
      `);
    });

    test("returns undefined for non-existent change type", () => {
      const label = parseLabel(mockConfig, "nonexistent");
      expect(label).toBeUndefined();
    });
  });

  describe("pkgs parsing", () => {
    test("parses pkg with 'pkg/' prefix", () => {
      const label = parseLabel(mockConfig, "pkg/core");
      expect(label).toMatchInlineSnapshot(`
        {
          "color": "FFFFFF",
          "description": "Label for affected Package: \\"Core Module\\"",
          "existing": "pkg/core",
          "name": "📦 core",
          "pkg": "core",
          "type": "pkgs",
        }
      `);
    });

    test("parses scope with 'type/' prefix", () => {
      expect(() => parseLabel(mockConfig, "type/cli")).toThrow(
        "invalid label type/cli. key cli could not be found on object with fields: major, breaking, feature, fix, chore",
      );
    });

    test("parses scope with package emoji prefix", () => {
      const label = parseLabel(mockConfig, "📦/docs");
      expect(label).toMatchInlineSnapshot(`
        {
          "color": "FFFFFF",
          "description": "Label for affected Package: \\"Documentation\\"",
          "existing": "📦/docs",
          "name": "📦 docs",
          "pkg": "docs",
          "type": "pkgs",
        }
      `);
    });

    test("throws error for non-existent scope key", () => {
      expect(() => {
        parseLabel(mockConfig, "scope/nonexistent");
      }).toThrow(
        "invalid label scope/nonexistent. key nonexistent could not be found on object with fields: core, cli, docs, api",
      );
    });
  });

  describe("input normalization", () => {
    test("handles colons by converting to slashes", () => {
      const label = parseLabel(mockConfig, "scope:core");
      expect(label).toMatchInlineSnapshot(`
        {
          "color": "FFFFFF",
          "description": "Label for affected Package: \\"Core Module\\"",
          "existing": "scope:core",
          "name": "📦 core",
          "pkg": "core",
          "type": "pkgs",
        }
      `);
    });

    test("handles spaces by converting to slashes", () => {
      const label = parseLabel(mockConfig, "scope core");
      expect(label).toMatchInlineSnapshot(`
        {
          "color": "FFFFFF",
          "description": "Label for affected Package: \\"Core Module\\"",
          "existing": "scope core",
          "name": "📦 core",
          "pkg": "core",
          "type": "pkgs",
        }
      `);
    });

    test("trims whitespace", () => {
      const label = parseLabel(mockConfig, "  feature  ");
      expect(label).toMatchInlineSnapshot(`
        {
          "changeType": "feature",
          "color": "0E8A16",
          "description": "Label for versioning: Feature",
          "existing": "  feature  ",
          "name": "✨ feature",
          "type": "changeTypes",
        }
      `);
    });
  });

  describe("emoji prefix parsing", () => {
    test("parses with feature emoji prefix", () => {
      const label = parseLabel(mockConfig, "✨/feature");
      expect(label).toMatchInlineSnapshot(`
        {
          "changeType": "feature",
          "color": "0E8A16",
          "description": "Label for versioning: Feature",
          "existing": "✨/feature",
          "name": "✨ feature",
          "type": "changeTypes",
        }
      `);
    });

    test("parses with fix emoji prefix", () => {
      const label = parseLabel(mockConfig, "🐛/fix");
      expect(label).toMatchInlineSnapshot(`
        {
          "changeType": "fix",
          "color": "FFFFFF",
          "description": "Label for versioning: Bug Fix",
          "existing": "🐛/fix",
          "name": "🐛 fix",
          "type": "changeTypes",
        }
      `);
    });

    test("parses with breaking change emoji prefix", () => {
      const label = parseLabel(mockConfig, "💥/breaking");
      expect(label).toMatchInlineSnapshot(`
        {
          "changeType": "breaking",
          "color": "FBCA04",
          "description": "Label for versioning: Breaking Change",
          "existing": "💥/breaking",
          "name": "💥 breaking",
          "type": "changeTypes",
        }
      `);
    });
  });

  describe("error cases", () => {
    test("throws error for too many slashes", () => {
      expect(() => {
        parseLabel(mockConfig, "scope/core/extra");
      }).toThrow(
        "invalid Label \"scope/core/extra\". only one '/' is allowed in labels for core",
      );
    });

    test("returns undefined for invalid prefix", () => {
      const label = parseLabel(mockConfig, "invalid/something");
      expect(label).toBeUndefined();
    });

    test("handles empty string gracefully", () => {
      const label = parseLabel(mockConfig, "");
      expect(label).toBeUndefined();
    });
  });

  describe("color fallback", () => {
    test("uses fallback color for unknown change type", () => {
      const configWithCustomType = {
        ...mockConfig,
        changeTypes: {
          ...mockConfig.changeTypes,
          custom: "Custom Type",
        },
      };

      const label = parseLabel(configWithCustomType, "custom");
      expect(label).toMatchInlineSnapshot(`
        {
          "changeType": "custom",
          "color": "FFFFFF",
          "description": "Label for versioning: Custom Type",
          "existing": "custom",
          "name": "🏷️ custom",
          "type": "changeTypes",
        }
      `);
    });
  });
});
