import { FetchApi } from "./changelog/fetch";
import { RenderAPI } from "./changelog/render";
import { lastTag } from "./git";
import {
  Change,
  Api,
  Config,
  RawConfig,
  ConfigSchema,
} from "./changelog/types";
import { propEq } from "ramda";
import { Github } from "./gh";
import { writeFile, readFile } from "fs/promises";
import { execVoid, exec, exit } from "./utils";
const isBreaking = (changes: Change[]) =>
  Boolean(changes.find(propEq("type", "breaking")));

const defaultPR = {
  major: "Major Change",
  breaking: "Breaking Change",
  feature: "New features",
  fix: "Bug Fixes",
  chore: "Minor Changes",
};

export class Releasy extends Api {
  private fetch: FetchApi;
  private render: RenderAPI;

  constructor({ pr, ...config }: RawConfig) {
    const github = new Github(config.gh, config.user);
    const cfg: Config = { pr: { ...defaultPR, ...pr }, ...config };
    super(cfg, github);
    this.fetch = new FetchApi(cfg, github);
    this.render = new RenderAPI(cfg, github);
  }

  public static async load() {
    const data = await readFile("./releasy.json", "utf8").then(JSON.parse);
    const config = ConfigSchema.parse(data);
    return new Releasy(config);
  }

  public version = () => exec(this.config.version);

  private initialVersion = () => {
    const version = lastTag();
    const projectVersion = this.version();

    if (version !== projectVersion) {
      throw Error(`versions does not match: ${version} ${projectVersion}`);
    }

    return version;
  };

  private next = async (isBreaking: boolean) => {
    const { next } = this.config;
    return execVoid(isBreaking ? `${next} -b` : next);
  };

  private open = async (body: string) => {
    this.github.setup();
    this.github.release(await this.version(), body);
  };

  private genChangelog = async (save?: string) => {
    const version = this.initialVersion();
    const changes = await this.fetch.changes(version);
    await this.next(isBreaking(changes));
    const txt = await this.render.changes(this.version(), changes);

    if (save) {
      await writeFile(`./${save}.md`, txt, "utf8");
    }

    return txt;
  };

  public changelog = async (save?: string) =>
    this.genChangelog(save).catch(exit);

  public release = (dry?: boolean) =>
    this.genChangelog()
      .then((txt) =>
        execVoid(this.config.setup).then(() =>
          dry ? undefined : this.open(txt)
        )
      )
      .catch(exit);
}
