#!/usr/bin/env node
import { Command } from "commander";
import {
  buildReleasePlan,
  checkLabels,
  exit,
  loadRelasy,
  validateConfig,
} from "@relasy/core";
import { readFile, writeFile } from "fs/promises";
import dotenv from "dotenv";

export const main = async () => {
  dotenv.config();

  const iRelasy = await loadRelasy();

  const cli = new Command()
    .name("Relasy")
    .description("Generate Automated Releases");

  cli.command("changelog").action(async () => {
    await writeFile(`./changelog.md`, await iRelasy.changelog(), "utf8");
  });

  cli.command("validate-config").action(async () => {
    const raw = JSON.parse(await readFile("./relasy.json", "utf8"));
    const result = validateConfig(raw);

    if (!result.ok) {
      throw new Error(`[${result.code}] ${result.message}`);
    }

    console.log("[relasy] Config is valid.");
  });

  cli
    .command("labels")
    .option("--check", "validate labels list")
    .option("--labels <labels>", "comma separated labels")
    .action((opts: { check?: boolean; labels?: string }) => {
      const labels = (opts.labels || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

      if (opts.check) {
        const result = checkLabels(iRelasy, labels, true);
        if (!result.ok) {
          throw new Error(`[${result.code}] ${result.message}`);
        }

        console.log(`[relasy] change_type=${result.data.changeType}`);
      }
    });

  cli.command("plan").action(async () => {
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
