import { lastTag, remote } from "./lib/git";
import { Api } from "./lib/changelog/types";
import { Github } from "./lib/gh";
import { loadConfig } from "./lib/config";
import { setupEnv } from "./lib/utils";
import { setupModule } from "./lib/module";
import { renderChangelog } from "./lib/changelog";
export { exit } from "./lib/utils";

export class Relasy extends Api {
  public static async load() {
    setupEnv();
    const config = await loadConfig();
    const github = new Github(config.gh);
    const module = setupModule(config.manager);

    return new Relasy(config, github, module);
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
}
