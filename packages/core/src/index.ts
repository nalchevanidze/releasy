import { lastTag } from "./lib/git";
import { Api } from "./lib/changelog/types";
import { Github } from "./lib/gh";
import { LabelType, loadConfig } from "./lib/config";
import { setupEnv } from "./lib/utils";
import { setupToolchain } from "./lib/project";
import { renderChangelog } from "./lib/changelog";
import { createLabel, genLabels, Label, parseLabel, parseLabels } from "./lib/labels";
export { exit } from "./lib/utils";

export class Relasy extends Api {
  public static async load() {
    setupEnv();
    const config = await loadConfig();
    const github = new Github(config.gh);
    const project = setupToolchain(config.project);

    return new Relasy(config, github, project);
  }

  public version = () => this.module.version();

  public changelog = async () => {
    const version = lastTag();
    const projectVersion = this.module.version();

    if (version.replace(/^v/, "") !== projectVersion.replace(/^v/, "")) {
      throw Error(`versions does not match: ${version} ${projectVersion}`);
    }

    return renderChangelog(this.config, this.module, this.github, version);
  };

  public labels(ls: string[]) {
    return genLabels(this.config, ls);
  }

  public parseLabels<T extends LabelType>(t: T, labels: string[]) {
    return parseLabels(this.config, t, labels);
  }
}
