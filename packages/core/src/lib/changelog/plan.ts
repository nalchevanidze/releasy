import { groupBy } from "ramda";
import {
  ChangelogDocumentNode,
  ChangelogGroupNode,
  ChangelogItemNode,
  ChangelogListNode,
  ChangelogNode,
  ChangelogSectionNode,
  InlinePart,
} from "./ast";
import { getDate } from "../git";
import { isKey } from "../utils";
import { Version } from "../version";
import { Api, Change } from "./types";

const maxInternalChangesToShow = 5;

const txt = (value: string): InlinePart => ({ type: "text", value });
const lnk = (label: string, url: string): InlinePart => ({ type: "link", label, url });

const normalizedPkgs = (pkgs: string[]) => [...new Set(pkgs)].sort();

const packageGroupKey = (pkgs: string[]) => {
  const normalized = normalizedPkgs(pkgs);
  return normalized.length ? normalized.join(",") : "general";
};

const packagePart = (api: Api, labelName: string): InlinePart => {
  const pkg = api.config.pkgs[labelName];
  const longName = pkg?.name || labelName;
  const url = api.module.pkg(longName);
  return url ? lnk(labelName, url) : txt(labelName);
};

const packageGroupParts = (api: Api, key: string): InlinePart[] => {
  if (key === "general") return [txt("General")];

  return key
    .split(",")
    .flatMap((pkg, idx) => [
      ...(idx > 0 ? [txt(" · ")] : []),
      packagePart(api, pkg),
    ]);
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

const sectionHeading = (api: Api, type: string, label: string) => ({
  icon: api.config.changeTypeEmojis?.[type] || (type === "internal" ? "🔧" : undefined),
  label,
});

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

const refLabel = (change: Change) => {
  if (change.number > 0) return `#${change.number}`;
  if (change.sourceCommit) return shortCommit(change);
  return "unknown";
};

const authorParts = (change: Change): InlinePart[] => {
  const login = change.author.login;
  const url = change.author.url;
  return url ? [lnk(`@${login}`, url)] : [txt(`@${login}`)];
};

const isCommitOnlyChange = (change: Change) =>
  Boolean(change.sourceCommit && change.number <= 0);

const primaryItem = (change: Change): ChangelogItemNode => ({
  type: "item",
  kind: "primary",
  ref: refLabel(change),
  title: changeTitle(change),
  scope: normalizedPkgs(change.pkgs),
  author: authorParts(change),
});

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
  kind: "internal",
  url: refinementUrl(api, change),
  title: changeTitle(change),
});

const primaryResolvedItem = (api: Api, change: Change) =>
  isCommitOnlyChange(change) ? internalItem(api, change) : primaryItem(change);

const buildPrimaryNodes = (api: Api, primaryChanges: Change[]): ChangelogNode[] => {
  const grouping = api.config.changelog?.grouping ?? "none";

  if (grouping === "none") {
    const list: ChangelogListNode = {
      type: "list",
      children: primaryChanges.map((change) => primaryResolvedItem(api, change)),
    };
    return [list];
  }

  const byType = groupBy(({ type }) => type, primaryChanges);
  const sectionTitles = { ...api.config.changeTypes };

  return Object.entries(sectionTitles).flatMap(([changeType, label]) => {
    if (!isKey(byType, changeType)) return [];

    const typeChanges = byType[changeType];

    if (grouping === "package") {
      const byPkg = groupBy((change: Change) => packageGroupKey(change.pkgs), typeChanges);

      const groups: ChangelogGroupNode[] = Object.entries(byPkg).map(([key, changes]) => ({
        type: "group",
        labelParts: packageGroupParts(api, key),
        children: changes.map((change) => primaryResolvedItem(api, change)),
      }));

      const section: ChangelogSectionNode = {
        type: "section",
        heading: sectionHeading(api, changeType, label),
        children: groups,
      };

      return [section];
    }

    const section: ChangelogSectionNode = {
      type: "section",
      heading: sectionHeading(api, changeType, label),
      children: [
        {
          type: "list",
          children: typeChanges.map((change) => primaryResolvedItem(api, change)),
        },
      ],
    };

    return [section];
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
    heading: sectionHeading(api, "internal", "Internal Changes"),
    overflowCount: hidden.length || undefined,
    children: [
      {
        type: "list",
        children: shown.map((change) => internalItem(api, change)),
      },
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
  ): ChangelogDocumentNode {
    const primaryChanges = changes.filter((x) => !x.isRefinement);
    const refinements = changes.filter((x) => x.isRefinement);

    const current = tag.toString();
    const header: ChangelogNode = {
      type: "header",
      versionLabel: current,
      compareUrl: previousTag
        ? `https://github.com/${this.api.config.gh}/compare/${tagRef(previousTag)}...${tagRef(current)}`
        : undefined,
      releaseDate: releaseDate || getDate(),
    };

    if (primaryChanges.length === 0 && refinements.length === 0) {
      return {
        type: "document",
        children: [header, { type: "empty", message: "No user-facing changes since the last tag." }],
      };
    }

    if (primaryChanges.length === 0) {
      const internal = internalSection(this.api, refinements);
      return {
        type: "document",
        children: internal
          ? [header, internal]
          : [header, { type: "empty", message: "No user-facing changes since the last tag." }],
      };
    }

    const nodes: ChangelogNode[] = [
      header,
      {
        type: "summary",
        bump: detectBump(this.api, primaryChanges),
        changeCount: primaryChanges.length,
        packageCount: new Set(primaryChanges.flatMap((change) => change.pkgs)).size,
      },
      { type: "divider" },
      ...buildPrimaryNodes(this.api, primaryChanges),
    ];

    const internal = internalSection(this.api, refinements);
    if (internal) nodes.push(internal);

    return { type: "document", children: nodes };
  }
}
