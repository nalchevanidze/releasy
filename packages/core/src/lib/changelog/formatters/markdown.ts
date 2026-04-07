import { ChangelogRenderer } from "./renderer";
import { Marker } from "../ast";

const lines = (...xs: (string[] | string | undefined)[]) => xs.flat().filter(Boolean).join("\n");


const withMarker = (type: Marker, txt: string) => {
  switch (type) {
    case "tree":
      return `&nbsp; └ ${txt}`;
    case "bullet":
      return `* ${txt}`;
    default:
      return txt;
  }
};

const list = (header: string | undefined, items: (string | string[])[], marker: Marker = "plain") =>
  lines(...[header, ...items.flat().map((item) => withMarker(marker, item))].filter(Boolean).map((value) => `${value}  `));

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

    const stats = node.stats ? (node.stats || []).map(render).join(" ") : undefined;

    return lines(header, stats, node.children.map(render));
  },

  section: (node, render) => lines(node.header ? render(node.header) : undefined, node.children.map(render), node.header ? "<br>" : undefined),

  cluster: ({ header, children, hiddenCount, marker }, render) =>
    list(header ? render(header) : undefined, [
      children.map(render),
      hiddenCount && hiddenCount > 0 ? `+${hiddenCount} more` : [],
    ], marker),

  item: (node, render) =>
    list(`**${node.refLabel}** — ${node.title}`, node.meta.map(render), "tree"),


  meta: ({ children, kind }, render) => {
    const value = children.map(render).join("");

    if (kind === "scope") return `📦 - ${value}`;
    if (kind === "author") return `✍️ - ${value}`;
    return value;
  },

  commit: ({ ref, title }, render) => {
    if (!ref) return title;
    return `🔘 - ${render(ref)} ${title}`;
  },

  header: (node, render) =>
    `${"#".repeat(node.level)} ${node.icon ? `${node.icon} ` : ""}${node.children.map(render).join("")}`,

  stat: ({ value, name }) => {
    if (name === "bump") {
      const bumpLabel = value.toUpperCase();
      const color =
        bumpLabel === "MAJOR" ? "red" : bumpLabel === "MINOR" ? "yellow" : "green";
      return `![BUMP](https://img.shields.io/badge/BUMP-${encodeURIComponent(bumpLabel)}-${color}?style=flat-square)`;
    }

    if (name === "changes") {
      return `![CHANGES](https://img.shields.io/badge/CHANGES-${encodeURIComponent(value)}-blue?style=flat-square)`;
    }

    return `![PACKAGES](https://img.shields.io/badge/PACKAGES-${encodeURIComponent(value)}-orange?style=flat-square)`;
  },

  text: ({ value }) => value,

  link: ({ label, url }) => `[${label}](${url})`,

  empty: () => "_No user-facing changes since the last tag._",
};
