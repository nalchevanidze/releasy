import { range } from "ramda";
import { ChangelogRenderer } from "./renderer";

const lines = (xs: string[], size: number = 1) =>
  xs
    .filter(Boolean)
    .join(
      range(0, size)
        .map(() => "\n")
        .join(""),
    );


const nbspIndent = (level: number, txt: string = "") =>
  `${range(0, level)
    .map(() => "&nbsp; &nbsp; ")
    .join("")}${txt}`;

export const markdownFormatter: ChangelogRenderer<string> = {
  doc: (node, render) => {
    const version = node.version.startsWith("v") ? node.version : `v${node.version}`;

    const parsedDate = new Date(`${node.date}T00:00:00Z`);
    const date = Number.isNaN(parsedDate.getTime())
      ? node.date
      : parsedDate.toLocaleDateString("en-US", {
        month: "long",
        day: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      });

    const versionText = node.compareUrl ? render({ type: "link", label: version, url: node.compareUrl }) : version;
    const header = `# 🚀 ${versionText} &nbsp; • &nbsp; ${date}`;

    const statsLine = (node.stats || []).map(render).join(" ");
    const body = lines(node.children.map(render), 2);

    if (statsLine) {
      return lines([header, statsLine, "---", body], 2);
    }

    return lines([header, body], 2);
  },

  section: (node, render) => {
    const heading = node.header ? render(node.header) : "";
    const body = lines(node.children.map(render));
    const overflow =
      node.overflowHiddenCount && node.overflowHiddenCount > 0
        ? nbspIndent(2, `└ +${node.overflowHiddenCount} more`)
        : "";

    return lines([heading, body, overflow, heading ? "<br>" : ""]);
  },

  cluster: (node, render) => {
    const heading = node.header ? render(node.header) : "";
    const renderedItems = node.children.map(render);

    const styledItems =
      node.childrenStyle === "tree"
        ? renderedItems.map((line) => `${nbspIndent(2, `└ ${line}`)}  `)
        : node.childrenStyle === "bullet"
          ? renderedItems.map((line) => `* ${line}`)
          : renderedItems;

    const compact =
      node.childrenStyle === "bullet" ||
      (node.childrenStyle !== "tree" &&
        node.children.every((child) => child.type === "primaryItem"));

    return compact
      ? lines([heading, ...styledItems], 1)
      : lines([heading, ...styledItems]);
  },

  primaryItem: (node, render) => {
    const meta = (node.children || []).map(render);
    const withBreaks = meta.map((line, idx) =>
      idx < meta.length - 1 ? `${line}  ` : line,
    );

    return lines([
      `**${node.refLabel}** — ${node.title}  `,
      ...withBreaks,
    ]);
  },

  internalItem: (node, render) => {
    const hash = render(node.tabel).trim();
    return hash ? `${hash} - ${node.value}` : node.value;
  },

  metaItem: (node, render) =>
    nbspIndent(1, `${node.icon} **${node.label}:** ${node.children.map(render).join("")}`),

  header: (node, render) =>
    `${"#".repeat(node.level)} ${node.icon ? `${node.icon} ` : ""}${node.children.map(render).join("")}`,

  stat: (node) => {
    if (node.name === "bump") {
      const bumpLabel = node.value.toUpperCase();
      const color =
        bumpLabel === "MAJOR" ? "red" : bumpLabel === "MINOR" ? "yellow" : "green";
      return `![BUMP](https://img.shields.io/badge/BUMP-${encodeURIComponent(bumpLabel)}-${color}?style=flat-square)`;
    }

    if (node.name === "changes") {
      return `![CHANGES](https://img.shields.io/badge/CHANGES-${encodeURIComponent(node.value)}-blue?style=flat-square)`;
    }

    return `![PACKAGES](https://img.shields.io/badge/PACKAGES-${encodeURIComponent(node.value)}-orange?style=flat-square)`;
  },

  text: (node) => node.value,

  link: (node) => `[${node.label}](${node.url})`,

  empty: () => "_No user-facing changes since the last tag._",
};
