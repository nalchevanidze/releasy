import { groupBy } from "ramda";
import {
  ClusterNode,
  DocNode,
  HeaderNode,
  LinkNode,
  MetaItemNode,
  PrimaryItemNode,
  SectionNode,
  StatNode,
  TextNode,
} from "./ast";
import { getDate } from "../git";
import { isKey } from "../utils";
import { Version } from "../version";
import { Api, Change } from "./types";

const maxInternalChangesToShow = 5;

const text = (value: string): TextNode => ({ type: "text", value });
const link = (label: string, url: string): LinkNode => ({ type: "link", label, url });

const normalizedPkgs = (pkgs: string[]) => [...new Set(pkgs)].sort();

const packageGroupKey = (pkgs: string[]) => {
  const normalized = normalizedPkgs(pkgs);
  return normalized.length ? normalized.join(",") : "general";
};

const packageHeader = (api: Api, key: string): HeaderNode => {
  if (key === "general") {
    return { type: "header", level: 5, icon: "📦", children: [text("General")] };
  }

  const children = key
    .split(",")
    .flatMap((pkg, idx) => {
      const conf = api.config.pkgs[pkg];
      const longName = conf?.name || pkg;
      const url = api.module.pkg(longName);

      return [
        ...(idx > 0 ? [text(" · ")] : []),
        url ? link(pkg, url) : text(pkg),
      ];
    });

  return { type: "header", level: 5, icon: "📦", children };
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

  return (
    change.number > 0 &&
    !change.sourceCommit &&
    (body.includes("<!-- relasy:release-pr -->") || isReleasePrTitle(title))
  );
};

const changeTitle = (change: Change) => change.title?.trim() || "Untitled change";

const shortCommit = (change: Change) => change.sourceCommit?.slice(0, 7) || "unknown";

const primaryRefLabel = (change: Change) => {
  if (change.number > 0) return `#${change.number}`;
  if (change.sourceCommit) return shortCommit(change);
  return "unknown";
};

const authorInline = (change: Change): Array<TextNode | LinkNode> => {
  const login = change.author.login?.trim();
  if (!login || login.toLowerCase() === "unknown") return [];
  return change.author.url ? [link(`@${login}`, change.author.url)] : [text(`@${login}`)];
};

const primaryItem = (change: Change): PrimaryItemNode => {
  const meta: MetaItemNode[] = [];

  const scope = normalizedPkgs(change.pkgs);
  if (scope.length > 0) {
    meta.push({
      type: "metaItem",
      kind: "scope",
      children: [text(scope.map((x) => `\`${x}\``).join(" • "))],
    });
  }

  const author = authorInline(change);
  if (author.length > 0) {
    meta.push({
      type: "metaItem",
      kind: "author",
      children: author,
    });
  }

  return {
    type: "primaryItem",
    refLabel: primaryRefLabel(change),
    title: changeTitle(change),
    meta: meta.length ? meta : undefined,
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

const unrecognizedCommitItem = (api: Api, change: Change): MetaItemNode => ({
  type: "metaItem",
  kind: "commit",
  children: change.sourceCommit
    ? [
      link(change.sourceCommit.slice(0, 7), refinementUrl(api, change)),
      text(` - ${changeTitle(change)}`),
    ]
    : [text(changeTitle(change))],
});

const resolvedItem = (
  api: Api,
  change: Change,
): PrimaryItemNode | MetaItemNode =>
  change.sourceCommit && change.number <= 0
    ? unrecognizedCommitItem(api, change)
    : primaryItem(change);

const sectionHeader = (api: Api, sectionId: string, sectionLabel: string): HeaderNode => ({
  type: "header",
  level: 3,
  icon: api.config.changeTypeEmojis?.[sectionId],
  children: [text(sectionLabel.toUpperCase())],
});

const bumpForType = (api: Api, type: string): "major" | "minor" | "patch" =>
  api.config.changeTypeBumps?.[type] ??
  (type === "breaking" ? "major" : type === "feature" ? "minor" : "patch");

const maintenanceSectionInfo = (api: Api): { id: string; label: string } | undefined => {
  if (isKey(api.config.changeTypes, "chore")) {
    return { id: "chore", label: api.config.changeTypes.chore };
  }

  for (const [id, label] of Object.entries(api.config.changeTypes)) {
    if (bumpForType(api, id) === "patch") {
      return { id, label };
    }
  }

  return undefined;
};

const unrecognizedSummary = (): PrimaryItemNode => ({
  type: "primaryItem",
  refLabel: "UNK",
  title: "commits missing Conventional Commit format or an associated PR",
});

const cluster = (
  children: Array<PrimaryItemNode | MetaItemNode>,
  header?: HeaderNode,
  itemsStyle?: "plain" | "tree" | "bullet",
): ClusterNode => ({
  type: "cluster",
  header,
  itemsStyle,
  children,
});

const buildPrimarySections = (api: Api, primaryChanges: Change[]): SectionNode[] => {
  const grouping = api.config.changelog?.grouping ?? "none";

  if (grouping === "none") {
    const items = primaryChanges.map((change) => resolvedItem(api, change));
    const hasInternal = items.some((item) => item.type === "metaItem");

    return [
      {
        type: "section",
        children: [cluster(items, undefined, hasInternal ? "tree" : "bullet")],
      },
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

      return [
        {
          type: "section",
          header: sectionHeader(api, sectionId, sectionLabel),
          children: Object.entries(byPkg).map(([key, pkgChanges]) =>
            cluster(
              pkgChanges.map((change) => resolvedItem(api, change)),
              packageHeader(api, key),
              "bullet",
            ),
          ),
        },
      ];
    }

    return [
      {
        type: "section",
        header: sectionHeader(api, sectionId, sectionLabel),
        children: [cluster(typeChanges.map((change) => resolvedItem(api, change)), undefined, "bullet")],
      },
    ];
  });
};

const unrecognizedCluster = (
  api: Api,
  refinements: Change[],
): { nodes: ClusterNode[]; overflowHiddenCount?: number } | undefined => {
  const visible = refinements.filter((change) => !isIgnoredRefinement(change));
  if (visible.length === 0) return undefined;

  const shown = visible.slice(0, maxInternalChangesToShow);
  const hidden = visible.slice(maxInternalChangesToShow);

  return {
    nodes: [
      cluster([unrecognizedSummary()], undefined, "bullet"),
      cluster(shown.map((change) => unrecognizedCommitItem(api, change)), undefined, "tree"),
    ],
    overflowHiddenCount: hidden.length || undefined,
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
  ): DocNode {
    const primaryChanges = changes.filter((x) => !x.isRefinement);
    const refinements = changes.filter((x) => x.isRefinement);

    const version = tag.toString();
    const compareUrl = previousTag
      ? `https://github.com/${this.api.config.gh}/compare/${tagRef(previousTag)}...${tagRef(version)}`
      : undefined;

    if (primaryChanges.length === 0 && refinements.length === 0) {
      return {
        type: "doc",
        version,
        date: releaseDate || getDate(),
        compareUrl,
        children: [{ type: "empty" }],
      };
    }

    if (primaryChanges.length === 0) {
      const unrecognized = unrecognizedCluster(this.api, refinements);
      const maintenance = maintenanceSectionInfo(this.api);

      if (!unrecognized || !maintenance) {
        return {
          type: "doc",
          version,
          date: releaseDate || getDate(),
          compareUrl,
          children: [{ type: "empty" }],
        };
      }

      return {
        type: "doc",
        version,
        date: releaseDate || getDate(),
        compareUrl,
        children: [
          {
            type: "section",
            header: sectionHeader(this.api, maintenance.id, maintenance.label),
            overflowHiddenCount: unrecognized.overflowHiddenCount,
            children: unrecognized.nodes,
          },
        ],
      };
    }

    const stats: StatNode[] = [
      { type: "stat", name: "bump", value: detectBump(this.api, primaryChanges) },
      { type: "stat", name: "changes", value: String(primaryChanges.length) },
      {
        type: "stat",
        name: "packages",
        value: String(new Set(primaryChanges.flatMap((change) => change.pkgs)).size),
      },
    ];

    const children = buildPrimarySections(this.api, primaryChanges);

    const unrecognized = unrecognizedCluster(this.api, refinements);
    if (unrecognized) {
      const grouping = this.api.config.changelog?.grouping ?? "none";

      if (grouping === "none") {
        if (children.length === 0) {
          children.push({
            type: "section",
            children: unrecognized.nodes,
            overflowHiddenCount: unrecognized.overflowHiddenCount,
          });
        } else {
          children[0].children.push(...unrecognized.nodes);
          children[0].overflowHiddenCount =
            (children[0].overflowHiddenCount || 0) + (unrecognized.overflowHiddenCount || 0) || undefined;
        }
      } else {
        const maintenance = maintenanceSectionInfo(this.api);

        if (maintenance) {
          const byType = groupBy(({ type }) => type, primaryChanges);
          const orderedIds = Object.keys(this.api.config.changeTypes).filter((id) => isKey(byType, id));
          const idx = orderedIds.indexOf(maintenance.id);

          if (idx >= 0 && children[idx]) {
            children[idx].children.push(...unrecognized.nodes);
            children[idx].overflowHiddenCount =
              (children[idx].overflowHiddenCount || 0) + (unrecognized.overflowHiddenCount || 0) || undefined;
          } else {
            children.push({
              type: "section",
              header: sectionHeader(this.api, maintenance.id, maintenance.label),
              overflowHiddenCount: unrecognized.overflowHiddenCount,
              children: unrecognized.nodes,
            });
          }
        }
      }
    }

    return {
      type: "doc",
      version,
      date: releaseDate || getDate(),
      compareUrl,
      stats,
      children,
    };
  }
}
