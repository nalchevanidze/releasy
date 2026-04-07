import { range } from "ramda";
import { InlinePart } from "../ast";
import { ChangelogRenderer, isSummaryBlock } from "./renderer";

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
  doc: (node, render) => {
    const version = normalizeVersionLabel(node.meta.versionLabel);
    const date = formatDateLong(node.meta.releaseDate);
    const versionText = node.meta.compareUrl
      ? link(version, node.meta.compareUrl)
      : version;
    const header = `# 🚀 ${versionText} &nbsp; • &nbsp; ${date}`;

    if (node.blocks.length === 0) return header;

    const renderedBlocks = node.blocks.map(render);

    if (node.blocks.length > 1 && isSummaryBlock(node.blocks[0])) {
      return lines([
        header,
        renderedBlocks[0],
        "---",
        ...renderedBlocks.slice(1),
      ], 2);
    }

    return lines([header, ...renderedBlocks], 2);
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

  section: (node, render) => {
    const body = lines(node.groups.map(render));
    const overflow =
      node.overflowHiddenCount && node.overflowHiddenCount > 0
        ? nbspIndent(2, `└ +${node.overflowHiddenCount} more`)
        : "";

    const label = node.label.toUpperCase();
    const heading = node.icon ? `### ${node.icon} ${label}` : `### ${label}`;

    return lines([heading, body, overflow, "<br>"]);
  },

  list: (node, render) => lines(node.items.map(render)),

  group: (node, render) => {
    const heading =
      node.kind === "package" ? `##### 📦 ${renderParts(node.label || [])}` : "";

    return lines([heading, ...node.items.map(render)]);
  },

  primaryChange: (node) => {
    const scope =
      node.scope.length === 0 ? "general" : node.scope.map((x) => `\`${x}\``).join(" • ");

    return lines([
      `* **${node.ref.label}** — ${node.title}  `,
      `${nbspIndent(1, `📦 **Scope:** ${scope}`)}  `,
      nbspIndent(1, `✍️ **By:** ${renderParts(node.author)}`),
    ]);
  },

  internalChange: (node) => {
    const ref = node.url ? link("└", node.url) : "└";
    return `${nbspIndent(2, `${ref} ${node.title}`)}  `;
  },

  empty: () => "_No user-facing changes since the last tag._",
};
