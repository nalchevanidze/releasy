import { range } from "ramda";
import {
  ChangelogChangeNode,
  ChangelogDocumentNode,
  ChangelogNode,
} from "../ast";
import { Change } from "../types";

export type MarkdownFormatterContext = {
  gh: string;
  issueUrl: (number: number) => string;
  pkgLink: (labelName: string) => string;
  changeTypeEmojis?: Record<string, string>;
};

const link = (name: string, url: string) => `[${name}](${url})`;

const newLine = (size: number) =>
  range(0, size)
    .map(() => "\n")
    .join("");

const lines = (xs: string[], size: number = 1) =>
  xs.filter(Boolean).join(newLine(size));

const nbspIndent = (level: number, txt: string = "") =>
  `${range(0, level)
    .map(() => "&nbsp; &nbsp; ")
    .join("")}${txt}`;

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

export class MarkdownFormatter {
  constructor(private context: MarkdownFormatterContext) {}

  private normalizedPkgs = (pkgs: string[]) => [...new Set(pkgs)].sort();

  private packageLinks = (pkgs: string[]) =>
    this.normalizedPkgs(pkgs).map(this.context.pkgLink);

  private scopeInline = (pkgs: string[]) => {
    const normalized = this.normalizedPkgs(pkgs);
    if (normalized.length === 0) return "general";

    return normalized.map((pkg) => `\`${pkg}\``).join(" • ");
  };

  private packageGroupTitle = (pkgKey: string) => {
    if (pkgKey === "general") return "General";
    return this.packageLinks(pkgKey.split(",")).join(" · ");
  };

  private shortCommit = (change: Change) =>
    change.sourceCommit?.slice(0, 7) || "unknown";

  private refLabel = (change: Change) => {
    if (change.number > 0) return `#${change.number}`;
    if (change.sourceCommit) return this.shortCommit(change);
    return "unknown";
  };

  private author = ({ author }: Change) =>
    author.url ? link(`@${author.login}`, author.url) : `@${author.login}`;

  private changeTitle = (change: Change) =>
    change.title?.trim() || "Untitled change";

  private defaultPrimaryItem = (change: Change) =>
    lines([
      `* **${this.refLabel(change)}** — ${this.changeTitle(change)}  `,
      `${nbspIndent(1, `📦 **Scope:** ${this.scopeInline(change.pkgs)}`)}  `,
      nbspIndent(1, `✍️ **By:** ${this.author(change)}`),
    ]);

  private refinementLink = (change: Change) => {
    if (change.sourceCommit) {
      return `https://github.com/${this.context.gh}/commit/${change.sourceCommit}`;
    }

    if (change.number > 0) {
      return this.context.issueUrl(change.number);
    }

    return `https://github.com/${this.context.gh}`;
  };

  private commitLine = (change: Change) =>
    `${nbspIndent(2, `${link("└", this.refinementLink(change))} ${this.changeTitle(change)}`)}  `;

  private linkedRefinementLine = (change: Change) =>
    `${nbspIndent(1, `[🔗](${this.refinementLink(change)}) &nbsp; ${this.changeTitle(change)}`)}  `;

  private badge = (label: string, value: string, color: string) =>
    `![${label}](https://img.shields.io/badge/${encodeURIComponent(label)}-${encodeURIComponent(value)}-${color}?style=flat-square)`;

  private sectionHeading = (type: string, label: string) => {
    const icon = this.context.changeTypeEmojis?.[type] || "";
    const headerLabel = label.toUpperCase();
    return icon ? `### ${icon} ${headerLabel}` : `### ${headerLabel}`;
  };

  private renderNode = (node: ChangelogNode): string => {
    switch (node.type) {
      case "document":
        return this.renderDocument(node);
      case "header": {
        const date = formatDateLong(node.releaseDate);
        const current = normalizeVersionLabel(node.version);

        if (node.previousTag) {
          const previous = normalizeVersionLabel(node.previousTag);
          const compareUrl = `https://github.com/${this.context.gh}/compare/${previous}...${current}`;
          return `# 🚀 ${link(current, compareUrl)} &nbsp; • &nbsp; ${date}`;
        }

        return `# 🚀 ${current} &nbsp; • &nbsp; ${date}`;
      }
      case "summary": {
        const bump = node.bump.toUpperCase();
        const bumpColor =
          bump === "MAJOR" ? "red" : bump === "MINOR" ? "yellow" : "green";

        return [
          this.badge("BUMP", bump, bumpColor),
          this.badge("CHANGES", String(node.changeCount), "blue"),
          this.badge("PACKAGES", String(node.packageCount || 0), "orange"),
        ].join(" ");
      }
      case "divider":
        return "---";
      case "section": {
        const renderedChildren = lines(node.children.map(this.renderNode));
        return lines([
          this.sectionHeading(node.changeType, node.label),
          renderedChildren,
          "<br>",
        ]);
      }
      case "group": {
        return lines([
          `##### 📦 ${this.packageGroupTitle(node.title)}`,
          ...node.children.map(this.renderNode),
        ]);
      }
      case "change": {
        if (node.variant === "primary") {
          return this.defaultPrimaryItem(node.change);
        }

        if (node.variant === "refinement-commit") {
          return this.commitLine(node.change);
        }

        return this.linkedRefinementLine(node.change);
      }
      case "refinements": {
        const overflow =
          node.hiddenCount > 0
            ? `${nbspIndent(2, `└ +${node.hiddenCount} more`)}`
            : "";

        return lines([
          node.includeDivider ? "---" : "",
          "### 🔧 INTERNAL CHANGES",
          "",
          ...node.children.map(this.renderRefinementChange),
          overflow,
        ]);
      }
      case "empty":
        return node.message;
    }
  };

  private renderRefinementChange = (node: ChangelogChangeNode) => {
    if (node.variant === "refinement-commit") {
      return this.commitLine(node.change);
    }

    return this.linkedRefinementLine(node.change);
  };

  public renderDocument = (document: ChangelogDocumentNode): string => {
    const rendered = document.children.map(this.renderNode);
    if (rendered.length === 0) return "";

    return rendered.slice(1).reduce((acc, current, index) => {
      const previousNode = document.children[index];
      const currentNode = document.children[index + 1];
      const compactListSeparator =
        previousNode?.type === "change" &&
        currentNode?.type === "change" &&
        previousNode.variant === "primary" &&
        currentNode.variant === "primary";

      return `${acc}${newLine(compactListSeparator ? 1 : 2)}${current}`;
    }, rendered[0]);
  };
}
