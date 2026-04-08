import { lastTag } from "../git";
import { FetchApi } from "./fetch";
import { markdownFormatter } from "./formatters/markdown";
import { renderAst } from "./formatters/renderer";
import { ChangelogPlanner, type Release } from "./plan";
import { Api } from "./types";

export type ChangelogOptions = {
  sinceRef?: string;
  all?: boolean;
};

export class Changelog {
  constructor(private api: Api) {}

  public documents(releases: Release[]): string {
    const ast = new ChangelogPlanner(this.api).buildDocument(releases);
    return renderAst(ast, markdownFormatter);
  }

  public async render(options: ChangelogOptions = {}): Promise<string> {
    const fetch = new FetchApi(this.api);
    const currentVersion = this.api.module.version();
    const sinceRef = options.sinceRef;

    if (!options.all && !sinceRef) {
      currentVersion.enforceVersionTagRule({
        lastTag,
        rule: this.api.config.policies?.rules?.versionTagMismatch,
        warn: (message) => this.api.logger.warn(message),
      });

      const plan = await fetch.fetchReleasePlan({ currentVersion });
      await this.api.module.bump(plan.bump);

      const nextVersion = this.api.module.version();
      nextVersion.checkAfterBump(plan.release.tag);

      return this.documents([plan.release]);
    }

    const releases = options.all
      ? await fetch.fetchReleases({ currentVersion, all: true })
      : [
          await fetch.previewRelease({
            currentVersion,
            sinceRef: sinceRef as string,
            sinceTag: undefined,
          }),
        ];

    return this.documents(releases);
  }
}
