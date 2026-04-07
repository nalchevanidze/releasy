#!/usr/bin/env node
import { Command } from "commander";
import {
  buildReleasePlan,
  checkLabels,
  exit,
  loadRelasy,
  normalizeConfig,
  normalizeConfigInputKeys,
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
  return "./relasy.yaml";
};

const readRelasyConfig = async (): Promise<unknown> => {
  const path = await resolveConfigPath();
  const content = await readFile(path, "utf8");

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
  await writeFile(
    "./relasy.yaml",
    yaml.dump(kebab, { lineWidth: 120 }),
    "utf8",
  );
};

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
          versionTagMismatch: "error",
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
        grouping: "package",
      },
    };

    await writeRelasyConfig(skeleton);
    console.log("[relasy] Initialized relasy.yaml");
  });

  cli
    .command("changelog")
    .option("--since-tag <tag>", "generate changelog since a specific tag")
    .option(
      "--since-commit <sha>",
      "generate changelog since a specific commit",
    )
    .option("--all", "generate full changelog across all tagged versions")
    .action(
      async (opts: {
        sinceTag?: string;
        sinceCommit?: string;
        all?: boolean;
      }) => {
        if (opts.all && (opts.sinceTag || opts.sinceCommit)) {
          throw new Error(
            "--all cannot be combined with --since-tag or --since-commit",
          );
        }

        if (opts.sinceTag && opts.sinceCommit) {
          throw new Error(
            "Use only one of --since-tag or --since-commit, not both.",
          );
        }

        const iRelasy = await loadRelasy();
        await writeFile(
          `./changelog.md`,
          await iRelasy.changelog({
            sinceTag: opts.sinceTag,
            sinceCommit: opts.sinceCommit,
            all: opts.all,
          }),
          "utf8",
        );
      },
    );

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

    const normalizedInput = normalizeConfigInputKeys(raw) as Record<
      string,
      unknown
    >;
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
        grouping: migrated.changelog?.grouping,
      },
    });

    console.log(
      "[relasy] Config migrated to latest schema shape (kebab-case + canonical policy keys).",
    );
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
