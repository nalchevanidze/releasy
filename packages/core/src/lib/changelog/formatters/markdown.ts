import { range } from "ramda";
import { ChangelogDocumentNode, ChangelogNode, InlinePart } from "../ast";

const newLine = (size: number) =>
  range(0, size)
    .map(() => "\n")
    .join("");

const lines = (xs: string[], size: number = 1) =>
  xs.filter(Boolean).join(newLine(size));

const link = (name: string, url: string) => `[${name}](${url})`;

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
  private renderParts = (parts: InlinePart[]) =>
    parts
      .map((part) =>
        part.type === "link" ? link(part.label, part.url) : part.value,
      )
      .join("");

  private renderNode = (node: ChangelogNode): string => {
    switch (node.type) {
      case "document":
        return this.renderDocument(node);
      case "header": {
        const version = normalizeVersionLabel(node.versionLabel);
        const date = formatDateLong(node.releaseDate);
        const versionText = node.compareUrl ? link(version, node.compareUrl) : version;
        return `# 🚀 ${versionText} &nbsp; • &nbsp; ${date}`;
      }
      case "summary":
      case "empty":
        return node.text;
      case "divider":
        return "---";
      case "item":
        return node.lines
          .map((line) => {
            const raw = this.renderParts(line.parts);
            const base = line.indentLevel ? nbspIndent(line.indentLevel, raw) : raw;
            return line.trailingBreak ? `${base}  ` : base;
          })
          .join("\n");
      case "list":
        return lines(node.children.map(this.renderNode));
      case "group":
        return lines([
          `${node.prefix}${this.renderParts(node.parts)}`,
          ...node.children.map(this.renderNode),
        ]);
      case "section": {
        const body = lines(node.children.map(this.renderNode));
        const overflow =
          node.overflowCount && node.overflowCount > 0
            ? nbspIndent(2, `└ +${node.overflowCount} more`)
            : "";
        const label = node.heading.label.toUpperCase();
        const heading = node.heading.icon
          ? `### ${node.heading.icon} ${label}`
          : `### ${label}`;
        return lines([heading, body, overflow, "<br>"]);
      }
    }
  };

  public renderDocument = (document: ChangelogDocumentNode): string =>
    lines(document.children.map(this.renderNode), 2);
}
