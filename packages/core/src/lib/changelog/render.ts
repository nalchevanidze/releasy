import { groupBy, range } from "ramda";
import { isKey } from "../utils";
import { Change, Api } from "./types";
import { getDate } from "../git";
import { Version } from "../version";

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
      .map(([topic, value]) => space(1, `- ${topic} ${value}`)),
  );

const indent = (txt: string, n: number = 1) =>
  space(n, txt.replace(/\n/g, `\n${space(n)}`));

export class RenderAPI {
  constructor(private api: Api) {}

  private pkg = (labelName: string) => {
    const longName = this.api.config.pkgs[labelName];
    const url = this.api.module.pkg(longName);
    return url ? link(labelName, url) : longName;
  };

  private change = ({ number, author, title, body, pkgs }: Change): string => {
    const details = body
      ? indent(lines(["- <details>", indent(body, 2), "  </details>"]), 1)
      : "";

    const head = `* ${link(
      `#${number}`,
      this.api.github.issue(number),
    )}: ${title?.trim()}`;

    const stats = stat([
      ["📦", lines(pkgs.map(this.pkg))],
      ["👤", link(`@${author.login}`, author.url)],
    ]);

    return lines([head, stats, details]);
  };

  private section = (label: string, changes: Change[]) =>
    lines([`#### ${label}`, ...changes.map(this.change)]);

  private sectionByPackage = (label: string, changes: Change[]) => {
    const byPkg = groupBy((change: Change) => change.pkgs.join(",") || "other", changes);

    return lines([
      `#### ${label}`,
      ...Object.entries(byPkg).flatMap(([pkgKey, pkgChanges]) => {
        const pkgTitle = pkgKey === "other" ? "General" : pkgKey;
        return lines([`##### 📦 ${pkgTitle}`, ...pkgChanges.map(this.change)]);
      }),
    ]);
  };

  public changes = (tag: Version, changes: Change[]) => {
    const groups = groupBy(({ type }) => type, changes);
    const sectionTitles = {
      ...this.api.config.changeTypes,
      ...(this.api.config.changelog?.sectionTitles ?? {}),
    };

    const headerTemplate = this.api.config.changelog?.headerTemplate;
    const header = headerTemplate
      ? headerTemplate
          .replace("{{VERSION}}", tag.toString())
          .replace("{{DATE}}", getDate())
      : `## ${tag.toString()} (${getDate()})`;

    return lines(
      [
        header,
        ...Object.entries(sectionTitles).flatMap(([type, label]) =>
          isKey(groups, type)
            ? this.api.config.changelog?.groupByPackage
              ? this.sectionByPackage(label, groups[type])
              : this.section(label, groups[type])
            : "",
        ),
      ],
      2,
    );
  };
}
