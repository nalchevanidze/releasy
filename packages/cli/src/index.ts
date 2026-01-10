#!/usr/bin/env node
import { Command } from "commander";
import { Relasy, exit } from "@relasy/core";
import { setup } from "./setup";

export const main = async () => {
  const easy = await Relasy.load();

  const cli = new Command()
    .name("Relasy")
    .description("Generate Automated Releases")
    .version(easy.version());

  cli.command("changelog").action(async () => {
    await easy.changelog("changelog");
  });

  cli.command("setup").action(setup);

  cli.parse();
};

main().catch(exit);
