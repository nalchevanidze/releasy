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

    return new MarkdownFormatter().renderDocument(ast);
  };
}
