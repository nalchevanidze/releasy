#!/usr/bin/env node
import { Command } from "commander";
import { Relasy, exit } from "@relasy/core";
import { writeFile } from "fs/promises";

export const main = async () => {
  const easy = await Relasy.load();

  const cli = new Command()
    .name("Relasy")
    .description("Generate Automated Releases");

  cli.command("changelog").action(async () => {
    await writeFile(`./changelog.md`, await easy.changelog(), "utf8");
  });

  cli.parse();
};

main().catch(exit);
