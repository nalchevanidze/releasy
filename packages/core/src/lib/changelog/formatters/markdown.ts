import { ChangeNode } from "../ast";
import { ChangelogRenderer } from "./renderer";

type Line = string | string[] | undefined;

const lines = (...ls: Line[]) =>
  ls
    .flat()
    .filter((x): x is string => x !== undefined)
    .reduce(
      (txt, line) =>
        txt.length === 0
          ? line
          : [txt, line.startsWith("  ") ? "  \n" : "\n", line].join(""),
      "",
    );

const list = (
  isTree: boolean,
  ...items: Array<string | string[] | undefined>
) =>
  items
    .flat()
    .filter((item): item is string => item !== undefined)
    .map((item) => (isTree ? `  └ ${item}` : `* ${item}`));

const indentText = (text: string, indent = "  ") =>
  text
    .split("\n")
    .map((line) => `${indent}${line}`)
    .join("\n");

const renderDetails = (summary: string, items: string[]) =>
  lines(
    "<details>",
    `<summary>${summary}</summary>`,
    "",
    list(true, items),
    "</details>",
  );

const isCollapsibleCommitGroup = (
  child: ChangeNode["children"][number],
): child is ChangeNode & { commits: NonNullable<ChangeNode["commits"]> } =>
  child.type === "change" &&
  child.level === 1 &&
  (child.commits?.length ?? 0) > 0;

export const markdownFormatter: ChangelogRenderer<string> = {
  doc: ({ releases }, render) => releases.map(render).join("\n\n<br>\n\n"),

  release: ({ headers, metrics, children }, render) =>
    lines(
      `# 🚀 ${headers.map(render).join(" • ")} `,
      metrics?.map(render).join(" "),
      children.map(render),
    ),

  change: ({ level, header, children, commits }, render) => {
    const headerText = header ? render(header) : undefined;

    if (level === 0) {
      const renderedChildren = children.map((child) => {
        if (isCollapsibleCommitGroup(child)) {
          const childHeader = child.header ? render(child.header) : undefined;
          const count = child.commits?.length ?? 0;
          const summary = `${count} commit${count === 1 ? "" : "s"}`;
          const details = renderDetails(summary, child.commits.map(render));

          return lines(
            `* ${childHeader}`,
            lines(list(true, child.children.map(render)), indentText(details)),
          );
        }

        return `* ${render(child)}`;
      });

      return lines(
        headerText,
        renderedChildren,
        headerText ? "<br>" : undefined,
      );
    }

    return lines(
      headerText,
      list(true, children.map(render)),
      list(true, commits?.map(render)),
    );
  },

  tag: ({ children, kind }, render) => {
    const value = children.map(render).join(" • ");

    if (kind === "scope") return `📦 - ${value} `;
    if (kind === "author") return `🧑‍💻 - ${value} `;
    return value;
  },

  commit: ({ ref, title }) => {
    if (!ref) return title;
    return `🔘 - [\`${ref.label}\`](${ref.url}) ${title} `;
  },

  header: (node, render) => {
    const children = node.children
      .map((child) => {
        if (child.type === "text") {
          return render({ ...child, value: child.value.toUpperCase() });
        }

        if (child.type === "link") {
          return render({ ...child, label: child.label.toUpperCase() });
        }

        return render(child);
      })
      .join("");

    return `### ${node.icon ? `${node.icon} ` : ""}${children} `;
  },

  title: ({ main, rest }, render) => {
    const tail = (rest ?? []).map(render).join("");
    return `${render(main)}${tail ? ` — ${tail}` : ""} `;
  },

  metric: ({ value, name }) => {
    if (name === "bump") {
      const bumpLabel = value.toUpperCase();
      const color =
        bumpLabel === "MAJOR"
          ? "red"
          : bumpLabel === "MINOR"
            ? "yellow"
            : "green";
      return `![BUMP](https://img.shields.io/badge/BUMP-${encodeURIComponent(bumpLabel)}-${color}?style=flat-square)`;
    }

    if (name === "changes") {
      return `![CHANGES](https://img.shields.io/badge/CHANGES-${encodeURIComponent(value)}-blue?style=flat-square)`;
    }

    return `![PACKAGES](https://img.shields.io/badge/PACKAGES-${encodeURIComponent(value)}-orange?style=flat-square)`;
  },

  date: ({ date }) =>
    date.toLocaleDateString("en-US", {
      month: "long",
      day: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    }),

  text: ({ value, style }) =>
    style === "literal"
      ? `\`${value}\``
      : style === "strong"
        ? `**${value}**`
        : value,

  link: ({ label, url }) => `[${label}](${url})`,
};
