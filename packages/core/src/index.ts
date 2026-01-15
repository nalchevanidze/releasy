import { lastTag, remote } from "./lib/git";
import { Api } from "./lib/changelog/types";
import { Github } from "./lib/gh";
import { ChangeType, LabelType, loadConfig } from "./lib/config";
import { setupEnv } from "./lib/utils";
import { setupToolchain } from "./lib/project";
import { renderChangelog } from "./lib/changelog";
import { createLabel, Label, parseLabel, parseLabels } from "./lib/labels";
export { exit } from "./lib/utils";
export { Label, createLabel } from "./lib/labels";

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
    const map = new Map<string, Label>();
    ls.forEach((l) => {
      const parsed = parseLabel(this.config, l);
      if (parsed) {
        map.set(parsed.name, parsed);
      }
    });

    const add =
      (t: LabelType) =>
      ([n, longName]: [string, string]) => {
        const l = createLabel(t, n, longName);
        if (!map.has(l.name)) {
          map.set(l.name, l);
        }
      };

    Object.entries(this.config.changeTypes).forEach(add("changeTypes"));
    Object.entries(this.config.scopes).forEach(add("scopes"));

    return [...map.values()];
  }

  public parseLabels<T extends LabelType>(t: T, labels: string[]) {
    return parseLabels(this.config, t, labels);
  }

  public parseLabel(original: string) {
    return parseLabel(this.config, original);
  }
}
