import { range } from "ramda";
import { ChangelogRenderer } from "./renderer";
import { ItemStyle } from "../ast";

const lines = (xs: string[], size: number = 1) =>
  xs
    .filter(Boolean)
    .join(
      range(0, size)
        .map(() => "\n")
        .join(""),
    );


const itemStyle = (type: ItemStyle, txt: string) => {
  switch (type) {
    case "tree":
      return `&nbsp; &nbsp; └ ${txt}  `;
    case "bullet":
      return `* ${txt}`;
    default:
      return txt;
  }
}

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
        ? itemStyle("tree", `+${node.overflowHiddenCount} more`)
        : "";

    return lines([heading, body, overflow, heading ? "<br>" : ""]);
  },

  cluster: (node, render) => {
    const heading = node.header ? render(node.header) : "";
    const renderedItems = node.children.map(render).map((line) => itemStyle(node.itemsStyle ?? "plain", line));

    const compact =
      node.itemsStyle === "bullet" ||
      (node.itemsStyle !== "tree" &&
        node.children.every((child) => child.type === "item"));

    return compact
      ? lines([heading, ...renderedItems], 1)
      : lines([heading, ...renderedItems]);
  },

  item: (node, render) => {
    return lines([
      `**${node.refLabel}** — ${node.title}`,
      ...(node.meta || []).map(render).map((line) => itemStyle("tree", line)),
    ]);
  },

  meta: (node, render) => {
    const value = node.children.map(render).join("");

    if (node.kind === "scope") return `📦 ${value}`;
    if (node.kind === "author") return `✍️ ${value}`;
    return value;
  },

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
