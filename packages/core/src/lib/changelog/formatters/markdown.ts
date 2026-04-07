import { ChangelogRenderer } from "./renderer";
import { Marker } from "../ast";

const lines = (...xs: (string[] | string | undefined)[]) => xs.filter(Boolean).join("\n");


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

const list = (header: string[], items: string[], marker: Marker = "plain") =>
  lines(header, items.map((item) => withMarker(marker, item)).map((value) => `${value}  `));

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

    const stats = node.stats ? [(node.stats || []).map(render).join(" ")] : [];

    return lines(header, stats, node.children.map(render));
  },

  section: (node, render) => {
    const heading = node.header ? render(node.header) : "";
    const body = lines(node.children.map(render));

    return lines([heading, body, heading ? "<br>" : ""]);
  },

  cluster: (node, render) => {

    return list(node.header ? [render(node.header)] : [], [
      node.children.map(render),
      node.hiddenCount && node.hiddenCount > 0 ? `+${node.hiddenCount} more` : [],
    ].flat(), node.marker);

  },

  item: (node, render) =>
    list([`**${node.refLabel}** — ${node.title}`], node.meta.map(render), "tree"),


  meta: (node, render) => {
    const value = node.children.map(render).join("");

    if (node.kind === "scope") return `📦 - ${value}`;
    if (node.kind === "author") return `✍️ - ${value}`;
    return value;
  },

  commit: (node, render) => {
    if (!node.ref) return node.title;
    return `🔘 - ${render(node.ref)} ${node.title}`;
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
