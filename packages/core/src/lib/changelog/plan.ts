import { groupBy } from "ramda";
import {
  ChangelogBlock,
  ChangelogDocNode,
  ChangelogGroupNode,
  ChangelogItemNode,
  ChangelogListBlock,
  ChangelogSectionBlock,
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
  type: "primaryChange",
  ref: { label: refLabel(change) },
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
  type: "internalChange",
  url: refinementUrl(api, change),
  title: changeTitle(change),
});

const primaryResolvedItem = (api: Api, change: Change) =>
  isCommitOnlyChange(change) ? internalItem(api, change) : primaryItem(change);

const sectionMeta = (api: Api, id: string, label: string) => ({
  id,
  label,
  icon: api.config.changeTypeEmojis?.[id] || (id === "internal" ? "🔧" : undefined),
});

const buildPrimaryBlocks = (api: Api, primaryChanges: Change[]): ChangelogBlock[] => {
  const grouping = api.config.changelog?.grouping ?? "none";

  if (grouping === "none") {
    const list: ChangelogListBlock = {
      type: "list",
      items: primaryChanges.map((change) => primaryResolvedItem(api, change)),
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
        kind: "package",
        label: packageGroupParts(api, key),
        items: changes.map((change) => primaryResolvedItem(api, change)),
      }));

      const section: ChangelogSectionBlock = {
        type: "section",
        ...sectionMeta(api, changeType, label),
        groups,
      };

      return [section];
    }

    const section: ChangelogSectionBlock = {
      type: "section",
      ...sectionMeta(api, changeType, label),
      groups: [
        {
          type: "group",
          kind: "flat",
          items: typeChanges.map((change) => primaryResolvedItem(api, change)),
        },
      ],
    };

    return [section];
  });
};

const internalSection = (
  api: Api,
  refinements: Change[],
): ChangelogSectionBlock | undefined => {
  const visible = refinements.filter((change) => !isIgnoredRefinement(change));
  if (visible.length === 0) return undefined;

  const shown = visible.slice(0, maxInternalChangesToShow);
  const hidden = visible.slice(maxInternalChangesToShow);

  return {
    type: "section",
    ...sectionMeta(api, "internal", "Internal Changes"),
    overflowHiddenCount: hidden.length || undefined,
    groups: [
      {
        type: "group",
        kind: "flat",
        items: shown.map((change) => internalItem(api, change)),
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
  ): ChangelogDocNode {
    const primaryChanges = changes.filter((x) => !x.isRefinement);
    const refinements = changes.filter((x) => x.isRefinement);

    const current = tag.toString();

    if (primaryChanges.length === 0 && refinements.length === 0) {
      return {
        type: "doc",
        meta: {
          versionLabel: current,
          compareUrl: previousTag
            ? `https://github.com/${this.api.config.gh}/compare/${tagRef(previousTag)}...${tagRef(current)}`
            : undefined,
          releaseDate: releaseDate || getDate(),
        },
        blocks: [{ type: "empty", reason: "no-user-facing-changes" }],
      };
    }

    if (primaryChanges.length === 0) {
      const internal = internalSection(this.api, refinements);
      return {
        type: "doc",
        meta: {
          versionLabel: current,
          compareUrl: previousTag
            ? `https://github.com/${this.api.config.gh}/compare/${tagRef(previousTag)}...${tagRef(current)}`
            : undefined,
          releaseDate: releaseDate || getDate(),
        },
        blocks: internal ? [internal] : [{ type: "empty", reason: "no-user-facing-changes" }],
      };
    }

    const blocks: ChangelogBlock[] = [
      {
        type: "summary",
        bump: detectBump(this.api, primaryChanges),
        changeCount: primaryChanges.length,
        packageCount: new Set(primaryChanges.flatMap((change) => change.pkgs)).size,
      },
      ...buildPrimaryBlocks(this.api, primaryChanges),
    ];

    const internal = internalSection(this.api, refinements);
    if (internal) blocks.push(internal);

    return {
      type: "doc",
      meta: {
        versionLabel: current,
        compareUrl: previousTag
          ? `https://github.com/${this.api.config.gh}/compare/${tagRef(previousTag)}...${tagRef(current)}`
          : undefined,
        releaseDate: releaseDate || getDate(),
      },
      blocks,
    };
  }
}
