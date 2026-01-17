import { Api } from "./lib/changelog/types";
import { Github } from "./lib/gh";
import { loadConfig } from "./lib/config";
import { setupEnv } from "./lib/utils";
import { setupToolchain } from "./lib/project";
import { renderChangelog } from "./lib/changelog";
import { genLabels, parseLabels } from "./lib/labels";
export { exit } from "./lib/utils";

export class Relasy extends Api {
  public static async load() {
    setupEnv();
    const config = await loadConfig();

    return new Relasy(
      config,
      new Github(config.gh),
      setupToolchain(config.project),
    );
  }

  public version = () => this.module.version();

  public changelog() {
    return renderChangelog(this);
  }

  public labels(ls: string[]) {
    return genLabels(this.config, ls);
  }

  public parseLabels(labels: string[]) {
    return parseLabels(this.config, labels);
  }
}
