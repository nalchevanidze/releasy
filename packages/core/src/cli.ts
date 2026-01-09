#!/usr/bin/env node
import { Command } from "commander";
import { Relasy } from "./lib/relasy";
import { exit } from "./lib/utils";

export const main = async () => {
  const easy = await Relasy.load();

  const cli = new Command()
    .name("Relasy")
    .description("Generate Automated Releases")
    .version("0.26.0");

  cli
    .command("open")
    .option("-d, --dry", "only changelog and setup", false)
    .action(({ dry }: { dry: boolean }) => easy.release(dry));

  cli
    .command("changelog")
    .action(() => easy.changelog("changelog").then(() => undefined));

  cli.parse();
};

main().catch(exit);
