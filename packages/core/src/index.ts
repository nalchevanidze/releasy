import { Api } from "./lib/changelog/types";
import { Github } from "./lib/gh";
import { loadConfig } from "./lib/config";
export {
  normalizeConfig,
  normalizeConfigInputKeys,
  validateChangelogTemplates,
} from "./lib/config";
import { setupEnv } from "./lib/utils";
import { setupToolchain } from "./lib/project";
import { renderChangelog, type ChangelogOptions } from "./lib/changelog";
import { genLabels, parseLabels } from "./lib/labels";
export * from "./app";
export { withRetry } from "./lib/retry";
export { exit } from "./lib/utils";

export interface IRelasy extends Api {
  version(): ReturnType<Api["module"]["version"]>;
  changelog(options?: ChangelogOptions): Promise<string>;
  labels(ls: string[]): ReturnType<typeof genLabels>;
  parseLabels(labels: string[]): ReturnType<typeof parseLabels>;
}

export class Relasy extends Api implements IRelasy {
  public static async load(): Promise<IRelasy> {
    setupEnv();
    const config = await loadConfig();

    return new Relasy(
      config,
      new Github(config.gh, undefined, config.project.baseBranch),
      setupToolchain(config.project),
    );
  }

  public version = () => this.module.version();

  public changelog(options?: ChangelogOptions) {
    return renderChangelog(this, options);
  }

  public labels(ls: string[]) {
    return genLabels(this.config, ls);
  }

  public parseLabels(labels: string[]) {
    return parseLabels(this.config, labels);
  }
}

export const loadRelasy = () => Relasy.load();
