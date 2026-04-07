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

const nbspIndent = (level: number, txt: string = "") =>
  `${range(0, level)
    .map(() => "&nbsp; &nbsp; ")
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

const maxInternalChangesToShow = 5;

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

  private ref = (change: Change) => {
    if (change.number > 0) {
      return link(`#${change.number}`, this.api.github.issue(change.number));
    }

    if (change.sourceCommit) {
      return this.shortCommit(change);
    }

    return "unknown";
  };

  private refLabel = (change: Change) => {
    if (change.number > 0) return `#${change.number}`;
    if (change.sourceCommit) return this.shortCommit(change);
    return "unknown";
  };

  private author = ({ author }: Change) =>
    author.url ? link(`@${author.login}`, author.url) : `@${author.login}`;

  private changeTitle = (change: Change) =>
    change.title?.trim() || "Untitled change";

  private shortCommit = (change: Change) =>
    change.sourceCommit?.slice(0, 7) || "unknown";

  private isCommitOnlyChange = (change: Change) =>
    Boolean(change.sourceCommit && change.number <= 0);

  private changeStats = (change: Change) =>
    lines([
      this.packageStats(change.pkgs),
      space(1, `- 🧑‍💻 ${this.author(change)}`),
    ]);

  private defaultPrimaryItem = (change: Change) =>
    lines([
      `* **${this.refLabel(change)}** — ${this.changeTitle(change)}  `,
      `${nbspIndent(1, `📦 **Scope:** ${this.scopeInline(change.pkgs)}`)}  `,
      nbspIndent(1, `✍️ **By:** ${this.author(change)}`),
    ]);

  private templatedItem = (change: Change) => {
    const template = this.api.config.changelog?.templates?.item;
    if (!template) return "";

    return applyTemplate(template, {
      REF: this.ref(change),
      TITLE: change.title?.trim() || "",
      AUTHOR: this.author(change),
      PACKAGES: lines(this.packageLinks(change.pkgs)),
      BODY: "",
      DETAILS: "",
      STATS: this.changeStats(change),
    });
  };

  private change = (change: Change): string => {
    if (this.isCommitOnlyChange(change)) {
      return this.commitLine(change);
    }

    const templated = this.templatedItem(change);
    if (templated) return templated;

    return this.defaultPrimaryItem(change);
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
    const bumpColor =
      bump === "MAJOR" ? "red" : bump === "MINOR" ? "yellow" : "green";

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

  private refinementLink = (change: Change) => {
    if (change.sourceCommit) {
      return `https://github.com/${this.api.config.gh}/commit/${change.sourceCommit}`;
    }

    if (change.number > 0) {
      return this.api.github.issue(change.number);
    }

    return `https://github.com/${this.api.config.gh}`;
  };

  private commitLine = (change: Change) =>
    `${nbspIndent(2, `${link("└", this.refinementLink(change))} ${this.changeTitle(change)}`)}  `;

  private linkedRefinementLine = (change: Change) =>
    `${nbspIndent(1, `[🔗](${this.refinementLink(change)}) &nbsp; ${this.changeTitle(change)}`)}  `;

  private refinementItem = (change: Change) =>
    change.sourceCommit ? this.commitLine(change) : this.linkedRefinementLine(change);

  private isReleasePrTitle = (title: string) =>
    /^publish release\s+v?\d+\.\d+\.\d+(?:[-+][\w.-]+)?\s*$/i.test(title);

  private isIgnoredRefinement = (change: Change) => {
    const title = change.title?.trim() || "";
    const body = change.body?.trim() || "";

    const markedReleasePr = body.includes("<!-- relasy:release-pr -->");
    const legacyReleasePrTitle = this.isReleasePrTitle(title);

    return (
      change.number > 0 &&
      !change.sourceCommit &&
      (markedReleasePr || legacyReleasePrTitle)
    );
  };

  private visibleRefinements = (changes: Change[]) =>
    changes.filter((change) => !this.isIgnoredRefinement(change));

  private hiddenRefinementLine = (change: Change) => {
    if (change.sourceCommit) {
      return `${this.shortCommit(change)}: ${this.changeTitle(change)}  `;
    }

    return this.changeTitle(change);
  };

  private refinementsOverflowDetails = (hidden: Change[]) => {
    if (hidden.length === 0) return "";

    return lines([
      `<details><summary>${nbspIndent(1, `and ${hidden.length} more`)}</summary>`,
      ...hidden.map(this.hiddenRefinementLine),
      "</details>",
    ]);
  };

  private refinementsSection = (
    changes: Change[],
    includeDivider: boolean = false,
  ) => {
    const visible = this.visibleRefinements(changes);
    if (visible.length === 0) return "";

    const shown = visible.slice(0, maxInternalChangesToShow);
    const hidden = visible.slice(maxInternalChangesToShow);

    return lines([
      includeDivider ? "---" : "",
      "### 🔧 INTERNAL CHANGES",
      "",
      ...shown.map(this.refinementItem),
      this.refinementsOverflowDetails(hidden),
    ]);
  };

  private header = (tag: Version, previousTag?: string, releaseDate?: string) => {
    const template = this.api.config.changelog?.templates?.header;

    if (!template) {
      return this.defaultHeader(tag, previousTag, releaseDate);
    }

    return applyTemplate(template, {
      VERSION: tag.toString(),
      DATE: getDate(),
    });
  };

  private sections = (primaryChanges: Change[]) => {
    const grouping = this.api.config.changelog?.grouping ?? "none";

    if (grouping === "none") {
      return [lines(primaryChanges.map(this.change))];
    }

    const groups = groupBy(({ type }) => type, primaryChanges);
    const sectionTitles = { ...this.api.config.changeTypes };

    return Object.entries(sectionTitles).flatMap(([type, label]) => {
      if (!isKey(groups, type)) return "";

      if (grouping === "package") {
        return this.sectionByPackage(type, label, groups[type]);
      }

      return this.section(type, label, groups[type]);
    });
  };

  private hasCustomLayout = () =>
    Boolean(
      this.api.config.changelog?.templates?.item ||
        this.api.config.changelog?.templates?.section,
    );

  private emptyState = (header: string) =>
    lines([header, "_No user-facing changes since the last tag._"], 2);

  public changes = (
    tag: Version,
    changes: Change[],
    previousTag?: string,
    releaseDate?: string,
  ) => {
    const primaryChanges = changes.filter((x) => !x.isRefinement);
    const refinements = changes.filter((x) => x.isRefinement);
    const header = this.header(tag, previousTag, releaseDate);

    if (primaryChanges.length === 0 && refinements.length === 0) {
      return this.emptyState(header);
    }

    if (primaryChanges.length === 0 && refinements.length > 0) {
      const refinementOnly = this.refinementsSection(refinements, false);
      return refinementOnly
        ? lines([header, refinementOnly], 2)
        : this.emptyState(header);
    }

    const sections = this.sections(primaryChanges);
    const summary = this.hasCustomLayout() ? "" : this.summary(primaryChanges);
    const divider = this.hasCustomLayout() ? "" : "---";
    const refinementsSection = this.refinementsSection(refinements);

    return lines(
      [header, summary, divider, ...sections, refinementsSection],
      2,
    );
  };
}
