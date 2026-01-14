import { groupBy, range } from "ramda";
import { isKey } from "../utils";
import { Change, Api } from "./types";
import { getDate } from "../git";

const link = (name: string, url: string) => `[${name}](${url})`;

const newLine = (size: number) =>
  range(0, size)
    .map(() => "\n")
    .join("");

const lines = (xs: string[], size: number = 1) =>
  xs.filter(Boolean).join(newLine(size));

const space = (n: number, txt: string = "") =>
  `${range(0, n * 2)
    .map(() => " ")
    .join("")}${txt}`;

const stat = (topics: [string, string][]) =>
  lines(
    topics
      .filter(([_, value]) => value)
      .map(([topic, value]) => space(1, `- ${topic} ${value}`))
  );

const indent = (txt: string, n: number = 1) =>
  space(n, txt.replace(/\n/g, `\n${space(n)}`));

export class RenderAPI extends Api {
  private pkg = (key: string) => {
    const id = this.config.scopes[key];
    return link(key, this.module.pkg(id));
  };

  private change = ({
    number,
    author,
    title,
    body,
    scopes,
  }: Change): string => {
    const details = body
      ? indent(lines(["- <details>", indent(body, 2), "  </details>"]), 1)
      : "";

    const head = `* ${link(
      `#${number}`,
      this.github.issue(number)
    )}: ${title?.trim()}`;

    const stats = stat([
      ["📦", lines(scopes.map(this.pkg))],
      ["👤", link(`@${author.login}`, author.url)],
    ]);

    return lines([head, stats, details]);
  };

  private section = (label: string, changes: Change[]) =>
    lines([`#### ${label}`, ...changes.map(this.change)]);

  public changes = (tag: string, changes: Change[]) => {
    const groups = groupBy(({ type }) => type, changes);

    return lines(
      [
        `## ${tag || "Unreleased"} (${getDate()})`,
        ...Object.entries(this.config.changeTypes).flatMap(([type, label]) =>
          isKey(groups, type) ? this.section(label, groups[type]) : ""
        ),
      ],
      2
    );
  };
}
