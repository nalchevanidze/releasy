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

  private normalizedPkgs = (pkgs: string[]) => [...new Set(pkgs)].sort();

  private packageLinks = (pkgs: string[]) =>
    this.normalizedPkgs(pkgs).map(this.pkg);

  private packageStats = (pkgs: string[]) => {
    const pkgLinks = this.packageLinks(pkgs);

    if (!pkgLinks.length) return space(1, "- 📦 General");
    if (pkgLinks.length === 1) return space(1, `- 📦 ${pkgLinks[0]}`);

    return space(1, `- 📦 Packages (${pkgLinks.length}): ${pkgLinks.join(", ")}`);
  };

  private packageInline = (pkgs: string[]) => {
    const pkgLinks = this.packageLinks(pkgs);

    if (!pkgLinks.length) return "📦 General";
    if (pkgLinks.length === 1) return `📦 ${pkgLinks[0]}`;

    return `📦 ${pkgLinks.join(", ")}`;
  };

  private authorInline = (change: Change) => `🧑‍💻 ${this.author(change)}`;

  private quoteBlock = (text: string) =>
    text
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");

  private renderBody = (body: string) => {
    const cleaned = body.trim();
    if (!cleaned) return "";

    const isSingleLine = !cleaned.includes("\n");
    const isShort = cleaned.length <= 140;

    if (isSingleLine && isShort) {
      return space(1, `📝 ${cleaned}`);
    }

    return indent(
      lines([
        "<details>",
        "  <summary>📝 PR details</summary>",
        "",
        this.quoteBlock(cleaned),
        "</details>",
      ]),
      1,
    );
  };

  private packageGroupKey = (pkgs: string[]) => {
    const normalized = this.normalizedPkgs(pkgs);
    return normalized.length ? normalized.join(",") : "other";
  };

  private packageGroupTitle = (pkgKey: string) => {
    if (pkgKey === "other") return "General";
    return this.packageLinks(pkgKey.split(",")).join(" · ");
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
    const details = this.renderBody(body || "");

    const stats = lines([
      this.packageStats(pkgs),
      space(1, `- 🧑‍💻 ${this.author(change)}`),
    ]);

    const defaultItem = lines([
      `* ${this.ref(change)} — **${title?.trim() || "Untitled change"}**`,
      space(1, `_${this.packageInline(pkgs)} · ${this.authorInline(change)}_`),
      details,
    ]);
    const template = this.api.config.changelog?.templates?.item;

    if (!template) return defaultItem;

    return applyTemplate(template, {
      REF: this.ref(change),
      TITLE: title?.trim() || "",
      AUTHOR: this.author(change),
      PACKAGES: lines(this.packageLinks(pkgs)),
      BODY: body || "",
      DETAILS: details,
      STATS: stats,
    });
  };

  private iconForType = (type: string) =>
    this.api.config.changeTypeEmojis?.[type] || "";

  private sectionHeading = (type: string, label: string) => {
    const icon = this.iconForType(type);
    return icon ? `#### ${icon} ${label}` : `#### ${label}`;
  };

  private summary = (changes: Change[]) => {
    const packageCount = new Set(changes.flatMap((change) => change.pkgs)).size;
    const byType = groupBy(({ type }) => type, changes);

    const typeSummary = Object.entries(this.api.config.changeTypes)
      .filter(([type]) => isKey(byType, type))
      .map(([type]) => {
        const icon = this.iconForType(type) || "•";
        return `${icon} ${byType[type].length}`;
      });

    return `> ${typeSummary.join(" · ")} · 📦 ${packageCount || 0} packages · 🔢 ${changes.length} changes`;
  };

  private section = (type: string, label: string, changes: Change[]) => {
    const renderedChanges = lines(changes.map(this.change));
    const template = this.api.config.changelog?.templates?.section;

    if (!template) {
      return lines([this.sectionHeading(type, label), renderedChanges]);
    }

    return applyTemplate(template, {
      LABEL: label,
      CHANGES: renderedChanges,
    });
  };

  private sectionByPackage = (type: string, label: string, changes: Change[]) => {
    const byPkg = groupBy(
      (change: Change) => this.packageGroupKey(change.pkgs),
      changes,
    );

    return lines([
      this.sectionHeading(type, label),
      ...Object.entries(byPkg).flatMap(([pkgKey, pkgChanges]) => {
        const pkgTitle = this.packageGroupTitle(pkgKey);
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

    if (changes.length === 0) {
      return lines([header, "_No user-facing changes since the last tag._"], 2);
    }

    const sections =
      grouping === "none"
        ? [lines(changes.map(this.change))]
        : Object.entries(sectionTitles).flatMap(([type, label]) => {
            if (!isKey(groups, type)) return "";

            if (grouping === "package") {
              return this.sectionByPackage(type, label, groups[type]);
            }

            return this.section(type, label, groups[type]);
          });

    const hasCustomLayout = Boolean(
      this.api.config.changelog?.templates?.item ||
        this.api.config.changelog?.templates?.section,
    );

    const summary = hasCustomLayout ? "" : this.summary(changes);

    return lines([header, summary, ...sections], 2);
  };
}
