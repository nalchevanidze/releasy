import { groupBy } from "ramda";
import {
  ChangelogDocNode,
  ChangelogClusterNode,
  ChangelogItemNode,
  ChangelogLinkNode,
  ChangelogSectionNode,
  ChangelogSubitemNode,
  ChangelogSummaryNode,
  ChangelogTextNode,
  ChangeRef,
  Header,
} from "./ast";
import { getDate } from "../git";
import { isKey } from "../utils";
import { Version } from "../version";
import { Api, Change } from "./types";

const maxInternalChangesToShow = 5;

const txt = (value: string): ChangelogTextNode => ({ type: "text", value });
const lnk = (label: string, url: string): ChangelogLinkNode => ({
  type: "link",
  label,
  url,
});

const normalizedPkgs = (pkgs: string[]) => [...new Set(pkgs)].sort();

const packageGroupKey = (pkgs: string[]) => {
  const normalized = normalizedPkgs(pkgs);
  return normalized.length ? normalized.join(",") : "general";
};

const markdownLink = (label: string, url: string) => `[${label}](${url})`;

const packageHeadingContent = (api: Api, key: string): string => {
  if (key === "general") return "General";

  return key
    .split(",")
    .map((labelName) => {
      const pkg = api.config.pkgs[labelName];
      const longName = pkg?.name || labelName;
      const url = api.module.pkg(longName);
      return url ? markdownLink(labelName, url) : labelName;
    })
    .join(" · ");
};

const detectBump = (
  api: Api,
  changes: Change[],
): "major" | "minor" | "patch" => {
  const rank = { patch: 0, minor: 1, major: 2 } as const;

  return changes.reduce<"major" | "minor" | "patch">((current, change) => {
    const bump =
      api.config.changeTypeBumps?.[change.type] ??
      (change.type === "breaking"
        ? "major"
        : change.type === "feature"
          ? "minor"
          : "patch");

    return rank[bump] > rank[current] ? bump : current;
  }, "patch");
};

const isReleasePrTitle = (title: string) =>
  /^publish release\s+v?\d+\.\d+\.\d+(?:[-+][\w.-]+)?\s*$/i.test(title);

const isIgnoredRefinement = (change: Change) => {
  const title = change.title?.trim() || "";
  const body = change.body?.trim() || "";

  const markedReleasePr = body.includes("<!-- relasy:release-pr -->");
  const legacyReleasePrTitle = isReleasePrTitle(title);

  return (
    change.number > 0 &&
    !change.sourceCommit &&
    (markedReleasePr || legacyReleasePrTitle)
  );
};

const changeTitle = (change: Change) => change.title?.trim() || "Untitled change";

const shortCommit = (change: Change) => change.sourceCommit?.slice(0, 7) || "unknown";

const refForPrimary = (change: Change): ChangeRef => {
  if (change.number > 0) return { label: `#${change.number}` };
  if (change.sourceCommit) return { label: shortCommit(change) };
  return { label: "unknown" };
};

const authorParts = (change: Change): Array<ChangelogTextNode | ChangelogLinkNode> => {
  const login = change.author.login?.trim();
  if (!login || login.toLowerCase() === "unknown") return [];

  const url = change.author.url;
  return url ? [lnk(`@${login}`, url)] : [txt(`@${login}`)];
};

const isCommitOnlyChange = (change: Change) =>
  Boolean(change.sourceCommit && change.number <= 0);

const primaryItem = (change: Change): ChangelogItemNode => {
  const children: ChangelogSubitemNode[] = [];

  const scopeValues = normalizedPkgs(change.pkgs);
  if (scopeValues.length > 0) {
    children.push({
      type: "subitem",
      icon: "📦",
      label: "Scope",
      children: [txt(scopeValues.map((x) => `\`${x}\``).join(" • "))],
    });
  }

  const authorInline = authorParts(change);
  if (authorInline.length > 0) {
    children.push({
      type: "subitem",
      icon: "✍️",
      label: "By",
      children: authorInline,
    });
  }

  return {
    type: "item",
    isInternal: false,
    ref: refForPrimary(change),
    title: changeTitle(change),
    children,
  };
};

const refinementUrl = (api: Api, change: Change) => {
  if (change.sourceCommit) {
    return `https://github.com/${api.config.gh}/commit/${change.sourceCommit}`;
  }

  if (change.number > 0) {
    return api.github.issue(change.number);
  }

  return `https://github.com/${api.config.gh}`;
};

const internalItem = (api: Api, change: Change): ChangelogItemNode => ({
  type: "item",
  isInternal: true,
  ref: { label: "└", url: refinementUrl(api, change) },
  title: changeTitle(change),
});

const resolvedItem = (api: Api, change: Change) =>
  isCommitOnlyChange(change) ? internalItem(api, change) : primaryItem(change);

const sectionMeta = (api: Api, sectionId: string, sectionLabel: string) => ({
  sectionLabel,
  sectionIcon:
    api.config.changeTypeEmojis?.[sectionId] ||
    (sectionId === "internal" ? "🔧" : undefined),
});

const makeCluster = (
  items: ReturnType<typeof resolvedItem>[],
  header?: Header,
): ChangelogClusterNode => ({
  type: "cluster",
  header,
  children: items,
});

const buildPrimaryBlocks = (
  api: Api,
  primaryChanges: Change[],
): Array<ChangelogSectionNode | ChangelogClusterNode> => {
  const grouping = api.config.changelog?.grouping ?? "none";

  if (grouping === "none") {
    return [
      makeCluster(primaryChanges.map((change) => resolvedItem(api, change))),
    ];
  }

  const byType = groupBy(({ type }) => type, primaryChanges);
  const sectionTitles = { ...api.config.changeTypes };

  return Object.entries(sectionTitles).flatMap(([sectionId, sectionLabel]) => {
    if (!isKey(byType, sectionId)) return [];

    const typeChanges = byType[sectionId];

    if (grouping === "package") {
      const byPkg = groupBy(
        (change: Change) => packageGroupKey(change.pkgs),
        typeChanges,
      );

      const groups = Object.entries(byPkg).map(([key, changes]) =>
        makeCluster(changes.map((change) => resolvedItem(api, change)), {
          type: "header",
          level: 5,
          icon: "📦",
          content: packageHeadingContent(api, key),
        }),
      );

      return [
        {
          type: "section",
          ...sectionMeta(api, sectionId, sectionLabel),
          children: groups,
        },
      ];
    }

    return [
      {
        type: "section",
        ...sectionMeta(api, sectionId, sectionLabel),
        children: [
          makeCluster(typeChanges.map((change) => resolvedItem(api, change))),
        ],
      },
    ];
  });
};

const internalSection = (
  api: Api,
  refinements: Change[],
): ChangelogSectionNode | undefined => {
  const visible = refinements.filter((change) => !isIgnoredRefinement(change));
  if (visible.length === 0) return undefined;

  const shown = visible.slice(0, maxInternalChangesToShow);
  const hidden = visible.slice(maxInternalChangesToShow);

  return {
    type: "section",
    ...sectionMeta(api, "internal", "Internal Changes"),
    overflowHiddenCount: hidden.length || undefined,
    children: [
      makeCluster(shown.map((change) => internalItem(api, change))),
    ],
  };
};

const tagRef = (version: string) => (version.startsWith("v") ? version : `v${version}`);

export class ChangelogPlanner {
  constructor(private api: Api) {}

  public build(
    tag: Version,
    changes: Change[],
    previousTag?: string,
    releaseDate?: string,
  ): ChangelogDocNode {
    const primaryChanges = changes.filter((x) => !x.isRefinement);
    const refinements = changes.filter((x) => x.isRefinement);

    const current = tag.toString();
    const compareUrl = previousTag
      ? `https://github.com/${this.api.config.gh}/compare/${tagRef(previousTag)}...${tagRef(current)}`
      : undefined;

    if (primaryChanges.length === 0 && refinements.length === 0) {
      return {
        type: "doc",
        versionLabel: current,
        releaseDate: releaseDate || getDate(),
        compareUrl,
        children: [{ type: "empty" }],
      };
    }

    if (primaryChanges.length === 0) {
      const internal = internalSection(this.api, refinements);
      return {
        type: "doc",
        versionLabel: current,
        releaseDate: releaseDate || getDate(),
        compareUrl,
        children: internal
          ? [internal]
          : [{ type: "empty" }],
      };
    }

    const summary: ChangelogSummaryNode = {
      type: "summary",
      bump: detectBump(this.api, primaryChanges),
      changeCount: primaryChanges.length,
      packageCount: new Set(primaryChanges.flatMap((change) => change.pkgs)).size,
    };

    const children: ChangelogDocNode["children"] = [
      summary,
      ...buildPrimaryBlocks(this.api, primaryChanges),
    ];

    const internal = internalSection(this.api, refinements);
    if (internal) children.push(internal);

    return {
      type: "doc",
      versionLabel: current,
      releaseDate: releaseDate || getDate(),
      compareUrl,
      children,
    };
  }
}
