import { range } from "ramda";
import { InlinePart } from "../ast";
import { ChangelogRenderer } from "./renderer";

const lines = (xs: string[], size: number = 1) =>
  xs
    .filter(Boolean)
    .join(
      range(0, size)
        .map(() => "\n")
        .join(""),
    );

const link = (name: string, url: string) => `[${name}](${url})`;

const nbspIndent = (level: number, txt: string = "") =>
  `${range(0, level)
    .map(() => "&nbsp; &nbsp; ")
    .join("")}${txt}`;

const renderParts = (parts: InlinePart[]) =>
  parts
    .map((part) => (part.type === "link" ? link(part.label, part.url) : part.value))
    .join("");

export const markdownFormatter: ChangelogRenderer<string> = {
  doc: (node, render) => {
    const version = node.versionLabel.startsWith("v")
      ? node.versionLabel
      : `v${node.versionLabel}`;

    const parsedDate = new Date(`${node.releaseDate}T00:00:00Z`);
    const date = Number.isNaN(parsedDate.getTime())
      ? node.releaseDate
      : parsedDate.toLocaleDateString("en-US", {
          month: "long",
          day: "2-digit",
          year: "numeric",
          timeZone: "UTC",
        });

    const versionText = node.compareUrl ? link(version, node.compareUrl) : version;
    const header = `# 🚀 ${versionText} &nbsp; • &nbsp; ${date}`;

    if (node.children.length === 0) return header;

    const renderedChildren = node.children.map(render);

    if (node.children[0]?.type === "summary") {
      return lines([header, renderedChildren[0], "---", ...renderedChildren.slice(1)], 2);
    }

    return lines([header, ...renderedChildren], 2);
  },

  summary: (node) => {
    const bumpLabel = node.bump.toUpperCase();
    const bumpColor =
      bumpLabel === "MAJOR" ? "red" : bumpLabel === "MINOR" ? "yellow" : "green";

    const summaryBadge = (label: string, value: string, color: string) =>
      `![${label}](https://img.shields.io/badge/${encodeURIComponent(label)}-${encodeURIComponent(value)}-${color}?style=flat-square)`;

    return [
      summaryBadge("BUMP", bumpLabel, bumpColor),
      summaryBadge("CHANGES", String(node.changeCount), "blue"),
      summaryBadge("PACKAGES", String(node.packageCount || 0), "orange"),
    ].join(" ");
  },

  section: (node, render) => {
    const body = lines(node.children.map(render));
    const overflow =
      node.overflowHiddenCount && node.overflowHiddenCount > 0
        ? nbspIndent(2, `└ +${node.overflowHiddenCount} more`)
        : "";

    const label = node.sectionLabel.toUpperCase();
    const heading = node.sectionIcon
      ? `### ${node.sectionIcon} ${label}`
      : `### ${label}`;

    return lines([heading, body, overflow, "<br>"]);
  },

  group: (node, render) => {
    const heading =
      node.groupKind === "package"
        ? `##### 📦 ${renderParts(node.groupLabel || [])}`
        : "";

    return lines([heading, render(node.children)]);
  },

  list: (node, render) => lines(node.children.map(render)),

  item: (node) => {
    if (node.isInternal) {
      const ref = node.ref.url ? link(node.ref.label, node.ref.url) : node.ref.label;
      return `${nbspIndent(2, `${ref} ${node.title}`)}  `;
    }

    const scope =
      (node.scope || []).length === 0
        ? "general"
        : (node.scope || []).map((x) => `\`${x}\``).join(" • ");

    return lines([
      `* **${node.ref.label}** — ${node.title}  `,
      `${nbspIndent(1, `📦 **Scope:** ${scope}`)}  `,
      nbspIndent(1, `✍️ **By:** ${renderParts(node.author || [])}`),
    ]);
  },

  empty: () => "_No user-facing changes since the last tag._",
};
