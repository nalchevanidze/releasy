#!/usr/bin/env node
import { Command } from "commander";
import {
  buildReleasePlan,
  checkLabels,
  exit,
  loadRelasy,
  normalizeConfig,
  validateChangelogTemplates,
  validateConfig,
} from "@relasy/core";
import { access, readFile, writeFile } from "fs/promises";
import dotenv from "dotenv";

type RawRelasyConfig = {
  configVersion?: number;
  pkgs: Record<string, string>;
  project: Record<string, unknown>;
  changelog?: {
    headerTemplate?: string;
    sectionTemplate?: string;
    itemTemplate?: string;
  };
};

const readRelasyConfig = async (): Promise<RawRelasyConfig> =>
  JSON.parse(await readFile("./relasy.json", "utf8"));

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
    try {
      await access("./relasy.json");
      console.log("[relasy] relasy.json already exists. Skipping init.");
      return;
    } catch {
      const skeleton = {
        configVersion: 1,
        pkgs: { core: "@scope/core" },
        project: { type: "npm" },
        labelPolicy: "strict",
        nonPrCommitsPolicy: "skip",
        changelog: {
          headerTemplate: "## {{VERSION}} ({{DATE}})",
        },
      };

      await writeFile("./relasy.json", `${JSON.stringify(skeleton, null, 2)}\n`, "utf8");
      console.log("[relasy] Initialized relasy.json");
    }
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

    const migrated = normalizeConfig(validated.data, "owner/repo");

    // keep runtime-only field out of persisted config
    const persisted = {
      ...raw,
      configVersion: migrated.configVersion ?? 1,
      labelPolicy: migrated.labelPolicy,
      nonPrCommitsPolicy: migrated.nonPrCommitsPolicy,
    };

    await writeFile("./relasy.json", `${JSON.stringify(persisted, null, 2)}\n`, "utf8");
    console.log("[relasy] Config migrated to latest compatible shape.");
  });

  cli.command("template-lint").action(async () => {
    const raw = await readRelasyConfig();
    validateChangelogTemplates(raw.changelog);
    console.log("[relasy] Changelog templates are valid.");
  });

  cli.command("template-preview").action(async () => {
    const raw = await readRelasyConfig();
    validateChangelogTemplates(raw.changelog);

    const header = raw.changelog?.headerTemplate
      ? applyTemplate(raw.changelog.headerTemplate, {
          VERSION: "v1.2.3",
          DATE: "2026-04-05",
        })
      : "## v1.2.3 (2026-04-05)";

    const section = raw.changelog?.sectionTemplate
      ? applyTemplate(raw.changelog.sectionTemplate, {
          LABEL: "Features",
          CHANGES: "* #123: Add preview support",
        })
      : "#### Features\n* #123: Add preview support";

    const item = raw.changelog?.itemTemplate
      ? applyTemplate(raw.changelog.itemTemplate, {
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
    console.log(`- labelPolicy: ${result.data.labelPolicy}`);
  });

  cli.parse();
};

main().catch(exit);
