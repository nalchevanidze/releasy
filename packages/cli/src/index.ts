#!/usr/bin/env node
import { Command } from "commander";
import { Relasy, exit } from "@relasy/core";
import { writeFile } from "fs/promises";
import dotenv from 'dotenv'

export const main = async () => {
  dotenv.config()

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
