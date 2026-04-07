import { Version } from "../version";
import { MarkdownFormatter } from "./formatters/markdown";
import { ChangelogPlanner } from "./plan";
import { Api, Change } from "./types";

export class RenderAPI {
  constructor(private api: Api) {}

  public changes = (
    tag: Version,
    changes: Change[],
    previousTag?: string,
    releaseDate?: string,
  ) => {
    const ast = new ChangelogPlanner(this.api).build(
      tag,
      changes,
      previousTag,
      releaseDate,
    );

    return new MarkdownFormatter({
      gh: this.api.config.gh,
      issueUrl: (number) => this.api.github.issue(number),
      pkgLink: (labelName) => {
        const pkg = this.api.config.pkgs[labelName];
        const longName = pkg?.name || labelName;
        const url = this.api.module.pkg(longName);
        return url ? `[${labelName}](${url})` : longName;
      },
      changeTypeEmojis: this.api.config.changeTypeEmojis,
    }).renderDocument(ast);
  };
}
