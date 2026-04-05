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

const applyTemplate = (template: string, values: Record<string, string>) =>
  Object.entries(values).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value),
    template,
  );

const formatDateLong = (date: string) => {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
};

const normalizeVersionLabel = (version: string) =>
  version.startsWith("v") ? version : `v${version}`;

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

    if (!pkgLinks.length) return "";
    if (pkgLinks.length === 1) return space(1, `- 📦 ${pkgLinks[0]}`);

    return space(
      1,
      `- 📦 Packages (${pkgLinks.length}): ${pkgLinks.join(", ")}`,
    );
  };

  private scopeInline = (pkgs: string[]) => {
    const normalized = this.normalizedPkgs(pkgs);
    if (normalized.length === 0) return "general";

    return normalized.map((pkg) => `\`${pkg}\``).join(" • ");
  };

  private packageGroupKey = (pkgs: string[]) => {
    const normalized = this.normalizedPkgs(pkgs);
    return normalized.length ? normalized.join(",") : "general";
  };

  private packageGroupTitle = (pkgKey: string) => {
    if (pkgKey === "general") return "General";
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

  private refLabel = ({ number, sourceCommit }: Change) => {
    if (number > 0) return `#${number}`;
    if (sourceCommit) return `commit ${sourceCommit.slice(0, 7)}`;
    return "unknown";
  };

  private author = ({ author }: Change) =>
    author.url ? link(`@${author.login}`, author.url) : `@${author.login}`;

  private change = (change: Change): string => {
    const { title, pkgs } = change;
    const template = this.api.config.changelog?.templates?.item;

    const stats = lines([
      this.packageStats(pkgs),
      space(1, `- 🧑‍💻 ${this.author(change)}`),
    ]);

    const defaultItem = lines([
      `* **${this.refLabel(change)}** — ${title?.trim() || "Untitled change"}`,
      space(1, `&nbsp; &nbsp; 📦 **Scope:** ${this.scopeInline(pkgs)}`),
      space(1, `&nbsp; &nbsp; ✍️ **By:** ${this.author(change)}`),
    ]);

    if (!template) return defaultItem;

    return applyTemplate(template, {
      REF: this.ref(change),
      TITLE: title?.trim() || "",
      AUTHOR: this.author(change),
      PACKAGES: lines(this.packageLinks(pkgs)),
      BODY: "",
      DETAILS: "",
      STATS: stats,
    });
  };

  private iconForType = (type: string) =>
    this.api.config.changeTypeEmojis?.[type] || "";

  private sectionHeading = (type: string, label: string) => {
    const icon = this.iconForType(type);
    const headerLabel = label.toUpperCase();
    return icon ? `### ${icon} ${headerLabel}` : `### ${headerLabel}`;
  };

  private detectBump = (changes: Change[]) => {
    const rank = { patch: 0, minor: 1, major: 2 } as const;

    return changes.reduce<"major" | "minor" | "patch">((current, change) => {
      const bump =
        this.api.config.changeTypeBumps?.[change.type] ??
        (change.type === "breaking"
          ? "major"
          : change.type === "feature"
            ? "minor"
            : "patch");

      return rank[bump] > rank[current] ? bump : current;
    }, "patch");
  };

  private badge = (label: string, value: string, color: string) =>
    `![${label}](https://img.shields.io/badge/${encodeURIComponent(label)}-${encodeURIComponent(value)}-${color}?style=flat-square)`;

  private summary = (changes: Change[]) => {
    const packageCount = new Set(changes.flatMap((change) => change.pkgs)).size;
    const bump = this.detectBump(changes).toUpperCase();
    const bumpColor = bump === "MAJOR" ? "red" : bump === "MINOR" ? "yellow" : "green";

    return [
      this.badge("BUMP", bump, bumpColor),
      this.badge("CHANGES", String(changes.length), "blue"),
      this.badge("PACKAGES", String(packageCount || 0), "orange"),
    ].join(" ");
  };

  private defaultHeader = (
    tag: Version,
    previousTag?: string,
    releaseDate?: string,
  ) => {
    const date = formatDateLong(releaseDate || getDate());
    const current = normalizeVersionLabel(tag.toString());

    if (previousTag) {
      const previous = normalizeVersionLabel(previousTag);
      const compareUrl = `https://github.com/${this.api.config.gh}/compare/${previous}...${current}`;
      return `# 🚀 ${link(current, compareUrl)} &nbsp; • &nbsp; ${date}`;
    }

    return `# 🚀 ${current} &nbsp; • &nbsp; ${date}`;
  };

  private section = (type: string, label: string, changes: Change[]) => {
    const renderedChanges = lines(changes.map(this.change));
    const template = this.api.config.changelog?.templates?.section;

    if (!template) {
      return lines([this.sectionHeading(type, label), renderedChanges, "<br>"]);
    }

    return applyTemplate(template, {
      LABEL: label,
      CHANGES: renderedChanges,
    });
  };

  private sectionByPackage = (
    type: string,
    label: string,
    changes: Change[],
  ) => {
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
      "<br>",
    ]);
  };

  public changes = (
    tag: Version,
    changes: Change[],
    previousTag?: string,
    releaseDate?: string,
  ) => {
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
      : this.defaultHeader(tag, previousTag, releaseDate);

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
    const divider = hasCustomLayout ? "" : "---";

    return lines([header, summary, divider, ...sections], 2);
  };
}
