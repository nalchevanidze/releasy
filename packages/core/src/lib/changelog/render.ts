import { Version } from "../version";
import { markdownFormatter } from "./formatters/markdown";
import { renderAst } from "./formatters/renderer";
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

    return renderAst(ast, markdownFormatter);
  };
}
