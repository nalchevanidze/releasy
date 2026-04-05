#!/usr/bin/env node
import { Command } from "commander";
import {
  buildReleasePlan,
  checkLabels,
  exit,
  loadRelasy,
  normalizeConfig,
  normalizeConfigInputKeys,
  validateChangelogTemplates,
  validateConfig,
} from "@relasy/core";
import { access, readFile, writeFile } from "fs/promises";
import yaml from "js-yaml";
import dotenv from "dotenv";

const exists = async (path: string) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const resolveConfigPath = async (): Promise<string> => {
  if (await exists("./relasy.yaml")) return "./relasy.yaml";
  if (await exists("./relasy.yml")) return "./relasy.yml";
  if (await exists("./relasy.json")) return "./relasy.json";
  return "./relasy.yaml";
};

const readRelasyConfig = async (): Promise<unknown> => {
  const path = await resolveConfigPath();
  const content = await readFile(path, "utf8");

  if (path.endsWith(".json")) {
    return JSON.parse(content);
  }

  return yaml.load(content) ?? {};
};

const camelToKebab = (key: string) =>
  key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toKebabCaseDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((x) => toKebabCaseDeep(x));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      camelToKebab(key),
      toKebabCaseDeep(child),
    ]),
  );
};

const writeRelasyConfig = async (config: unknown) => {
  const kebab = toKebabCaseDeep(config);
  await writeFile("./relasy.yaml", yaml.dump(kebab, { lineWidth: 120 }), "utf8");
};

const applyTemplate = (template: string, values: Record<string, string>) =>
  Object.entries(values).reduce(
    (acc, [key, value]) => acc.split(`{{${key}}}`).join(value),
    template,
  );

export const main = async () => {
  dotenv.config();

  const cli = new Command()
    .name("Relasy")
    .description("Generate Automated Releases");

  cli.command("init").action(async () => {
    if ((await exists("./relasy.yaml")) || (await exists("./relasy.yml"))) {
      console.log("[relasy] relasy.yaml already exists. Skipping init.");
      return;
    }

    const skeleton = {
      pkgs: {
        core: {
          name: "@scope/core",
          paths: ["packages/core/**"],
        },
      },
      project: { type: "npm" },
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
      changes: {
        feature: {
          icon: "✨",
          title: "New Features",
          bump: "minor",
        },
        fix: {
          icon: "🐛",
          title: "Bug Fixes",
          bump: "patch",
        },
      },
      changelog: {
        templates: {
          header: "## {{VERSION}} ({{DATE}})",
        },
        grouping: "package",
      },
    };

    await writeRelasyConfig(skeleton);
    console.log("[relasy] Initialized relasy.yaml");
  });

  cli.command("changelog").action(async () => {
    const iRelasy = await loadRelasy();
    await writeFile(`./changelog.md`, await iRelasy.changelog(), "utf8");
  });

  cli.command("validate-config").action(async () => {
    const raw = await readRelasyConfig();
    const result = validateConfig(raw);

    if (!result.ok) {
      throw new Error(`[${result.code}] ${result.message}`);
    }

    console.log("[relasy] Config is valid.");
  });

  cli.command("migrate-config").action(async () => {
    const raw = await readRelasyConfig();
    const validated = validateConfig(raw);

    if (!validated.ok) {
      throw new Error(`[${validated.code}] ${validated.message}`);
    }

    const normalizedInput = normalizeConfigInputKeys(raw) as Record<string, unknown>;
    const migrated = normalizeConfig(validated.data, "owner/repo");

    await writeRelasyConfig({
      ...normalizedInput,
      pkgs: migrated.pkgs,
      policies: migrated.policies,
      changes: Object.fromEntries(
        Object.entries(migrated.changeTypes).map(([key, title]) => [
          key,
          {
            title,
            icon: migrated.changeTypeEmojis?.[key],
            bump: migrated.changeTypeBumps?.[key],
            paths: migrated.changeTypeScopes?.[key]?.paths,
          },
        ]),
      ),
      changelog: {
        templates: migrated.changelog?.templates,
        grouping: migrated.changelog?.grouping,
      },
    });

    console.log(
      "[relasy] Config migrated to latest schema shape (kebab-case + canonical policy keys).",
    );
  });

  cli.command("template-lint").action(async () => {
    const raw = normalizeConfigInputKeys(await readRelasyConfig()) as {
      changelog?: { templates?: { header?: string; section?: string; item?: string } };
    };
    validateChangelogTemplates(raw.changelog);
    console.log("[relasy] Changelog templates are valid.");
  });

  cli.command("template-preview").action(async () => {
    const raw = normalizeConfigInputKeys(await readRelasyConfig()) as {
      changelog?: { templates?: { header?: string; section?: string; item?: string } };
    };
    validateChangelogTemplates(raw.changelog);

    const header = raw.changelog?.templates?.header
      ? applyTemplate(raw.changelog.templates.header, {
          VERSION: "v1.2.3",
          DATE: "2026-04-05",
        })
      : "## v1.2.3 (2026-04-05)";

    const section = raw.changelog?.templates?.section
      ? applyTemplate(raw.changelog.templates.section, {
          LABEL: "Features",
          CHANGES: "* #123: Add preview support",
        })
      : "#### Features\n* #123: Add preview support";

    const item = raw.changelog?.templates?.item
      ? applyTemplate(raw.changelog.templates.item, {
          REF: "#123",
          TITLE: "Add preview support",
          AUTHOR: "@dev",
          PACKAGES: "core",
          BODY: "details",
          DETAILS: "",
          STATS: "",
        })
      : "* #123: Add preview support";

    console.log("[relasy] Template preview\n");
    console.log(header);
    console.log("\n");
    console.log(section);
    console.log("\n");
    console.log(item);
  });

  cli
    .command("labels")
    .option("--check", "validate labels list")
    .option("--labels <labels>", "comma separated labels")
    .action(async (opts: { check?: boolean; labels?: string }) => {
      const labels = (opts.labels || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

      if (opts.check) {
        const iRelasy = await loadRelasy();
        const result = checkLabels(iRelasy, labels, true);
        if (!result.ok) {
          throw new Error(`[${result.code}] ${result.message}`);
        }

        console.log(`[relasy] change_type=${result.data.changeType}`);
      }
    });

  cli.command("plan").action(async () => {
    const iRelasy = await loadRelasy();
    const result = await buildReleasePlan(iRelasy);

    if (!result.ok) {
      throw new Error(`[${result.code}] ${result.message}`);
    }

    console.log("[relasy] Release plan");
    console.log(`- version: ${result.data.version}`);
    console.log(`- baseBranch: ${result.data.baseBranch}`);
    console.log(`- labelMode: ${result.data.labelMode}`);
    console.log(`- detectionUse: ${result.data.detectionUse.join(",")}`);
  });

  cli.parse();
};

main().catch(exit);
