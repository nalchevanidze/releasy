import { range } from "ramda";
import { InlinePart } from "../ast";
import { ChangelogRenderer } from "./renderer";

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

const badge = (label: string, value: string, color: string) =>
  `![${label}](https://img.shields.io/badge/${encodeURIComponent(label)}-${encodeURIComponent(value)}-${color}?style=flat-square)`;

const renderParts = (parts: InlinePart[]) =>
  parts
    .map((part) => (part.type === "link" ? link(part.label, part.url) : part.value))
    .join("");

export const markdownFormatter: ChangelogRenderer<string> = {
  document: (node, render) => lines(node.children.map(render), 2),

  header: (node) => {
    const version = normalizeVersionLabel(node.versionLabel);
    const date = formatDateLong(node.releaseDate);
    const versionText = node.compareUrl ? link(version, node.compareUrl) : version;
    return `# 🚀 ${versionText} &nbsp; • &nbsp; ${date}`;
  },

  summary: (node) => {
    const bumpLabel = node.bump.toUpperCase();
    const bumpColor =
      bumpLabel === "MAJOR" ? "red" : bumpLabel === "MINOR" ? "yellow" : "green";

    return [
      badge("BUMP", bumpLabel, bumpColor),
      badge("CHANGES", String(node.changeCount), "blue"),
      badge("PACKAGES", String(node.packageCount || 0), "orange"),
    ].join(" ");
  },

  divider: () => "---",

  item: (node) => {
    if (node.kind === "internal") {
      return `${nbspIndent(2, `${link("└", node.url)} ${node.title}`)}  `;
    }

    const scope =
      node.scope.length === 0 ? "general" : node.scope.map((x) => `\`${x}\``).join(" • ");

    return lines([
      `* **${node.ref}** — ${node.title}  `,
      `${nbspIndent(1, `📦 **Scope:** ${scope}`)}  `,
      nbspIndent(1, `✍️ **By:** ${renderParts(node.author)}`),
    ]);
  },

  list: (node, render) => lines(node.children.map(render)),

  group: (node, render) =>
    lines([
      `##### 📦 ${renderParts(node.labelParts)}`,
      ...node.children.map(render),
    ]),

  section: (node, render) => {
    const body = lines(node.children.map(render));
    const overflow =
      node.overflowCount && node.overflowCount > 0
        ? nbspIndent(2, `└ +${node.overflowCount} more`)
        : "";
    const label = node.heading.label.toUpperCase();
    const heading = node.heading.icon
      ? `### ${node.heading.icon} ${label}`
      : `### ${label}`;

    return lines([heading, body, overflow, "<br>"]);
  },

  empty: (node) => `_${node.message}_`,
};
