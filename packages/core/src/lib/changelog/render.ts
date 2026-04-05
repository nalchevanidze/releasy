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

const applyTemplate = (template: string, values: Record<string, string>) =>
  Object.entries(values).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value),
    template,
  );

export class RenderAPI {
  constructor(private api: Api) {}

  private pkg = (labelName: string) => {
    const pkg = this.api.config.pkgs[labelName];
    const longName = pkg?.name || labelName;
    const url = this.api.module.pkg(longName);
    return url ? link(labelName, url) : longName;
  };

  private ref = ({ number, sourceCommit }: Change) => {
    if (number > 0) {
      return link(`#${number}`, this.api.github.issue(number));
    }

    if (sourceCommit) {
      return `commit ${sourceCommit.slice(0, 7)}`;
    }

    return "unknown";
  };

  private author = ({ author }: Change) =>
    author.url ? link(`@${author.login}`, author.url) : `@${author.login}`;

  private change = (change: Change): string => {
    const { title, body, pkgs } = change;
    const details = body
      ? indent(lines(["- <details>", indent(body, 2), "  </details>"]), 1)
      : "";

    const stats = stat([
      ["📦", lines(pkgs.map(this.pkg))],
      ["👤", this.author(change)],
    ]);

    const defaultItem = lines([
      `* ${this.ref(change)}: ${title?.trim()}`,
      stats,
      details,
    ]);
    const template = this.api.config.changelog?.templates?.item;

    if (!template) return defaultItem;

    return applyTemplate(template, {
      REF: this.ref(change),
      TITLE: title?.trim() || "",
      AUTHOR: this.author(change),
      PACKAGES: lines(pkgs.map(this.pkg)),
      BODY: body || "",
      DETAILS: details,
      STATS: stats,
    });
  };

  private section = (label: string, changes: Change[]) => {
    const renderedChanges = lines(changes.map(this.change));
    const template = this.api.config.changelog?.templates?.section;

    if (!template) {
      return lines([`#### ${label}`, renderedChanges]);
    }

    return applyTemplate(template, {
      LABEL: label,
      CHANGES: renderedChanges,
    });
  };

  private sectionByPackage = (label: string, changes: Change[]) => {
    const byPkg = groupBy(
      (change: Change) => change.pkgs.join(",") || "other",
      changes,
    );

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
    };

    const headerTemplate = this.api.config.changelog?.templates?.header;
    const header = headerTemplate
      ? applyTemplate(headerTemplate, {
          VERSION: tag.toString(),
          DATE: getDate(),
        })
      : `## ${tag.toString()} (${getDate()})`;

    const grouping = this.api.config.changelog?.grouping ?? "none";

    const sections =
      grouping === "none"
        ? [lines(changes.map(this.change))]
        : Object.entries(sectionTitles).flatMap(([type, label]) => {
            if (!isKey(groups, type)) return "";

            if (grouping === "package") {
              return this.sectionByPackage(label, groups[type]);
            }

            return this.section(label, groups[type]);
          });

    return lines([header, ...sections], 2);
  };
}
