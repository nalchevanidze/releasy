import { FetchApi } from "./changelog/fetch";
import { RenderAPI } from "./changelog/render";
import { lastTag } from "./git";
import { Change, Api } from "./changelog/types";
import { propEq } from "ramda";
import { Github } from "./gh";
import { writeFile } from "fs/promises";
import { exit } from "./utils";
import { Config, loadConfig } from "./config";
import { NpmModule } from "./module/npm";
import { Module } from "./module/types";

const isBreaking = (changes: Change[]) =>
  Boolean(changes.find(propEq("type", "breaking")));

export class Relasy extends Api {
  private fetch: FetchApi;
  private render: RenderAPI;
  public module: Module = new NpmModule();

  constructor(config: Config) {
    const github = new Github(config.gh, config.user);
    super(config, github);
    this.fetch = new FetchApi(config, github);
    this.render = new RenderAPI(config, github);
  }

  public static async load() {
    return new Relasy(await loadConfig());
  }

  public version = () => this.module.version();

  private initialVersion = () => {
    const version = lastTag();
    const projectVersion = this.version();

    if (version.replace(/^v/, "") !== projectVersion.replace(/^v/, "")) {
      throw Error(`versions does not match: ${version} ${projectVersion}`);
    }

    return version;
  };

  private open = async (body: string) => {
    this.github.setup();
    this.github.release(await this.version(), body);
  };

  private genChangelog = async (save?: string) => {
    const version = this.initialVersion();
    const changes = await this.fetch.changes(version);
    await this.module.next(isBreaking(changes));
    const txt = await this.render.changes(this.version(), changes);

    if (save) {
      await writeFile(`./${save}.md`, txt, "utf8");
    }

    return txt;
  };

  public changelog = async (save?: string) =>
    this.genChangelog(save).catch(exit);

  public release = () =>
    this.genChangelog()
      .then((txt) => this.module.setup().then(() => this.open(txt)))
      .catch(exit);
}
