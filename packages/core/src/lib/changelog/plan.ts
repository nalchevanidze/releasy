import { groupBy } from "ramda";
import { getDate } from "../git";
import { isKey } from "../utils";
import { Version } from "../version";
import {
  ChangelogChangeNode,
  ChangelogDocumentNode,
  ChangelogNode,
  ChangelogRefinementsNode,
} from "./ast";
import { Api, Change } from "./types";

const maxInternalChangesToShow = 5;

const normalizedPkgs = (pkgs: string[]) => [...new Set(pkgs)].sort();

const packageGroupKey = (pkgs: string[]) => {
  const normalized = normalizedPkgs(pkgs);
  return normalized.length ? normalized.join(",") : "general";
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

const visibleRefinements = (changes: Change[]) =>
  changes.filter((change) => !isIgnoredRefinement(change));

const refinementNode = (change: Change): ChangelogChangeNode => ({
  type: "change",
  variant: change.sourceCommit ? "refinement-commit" : "refinement-link",
  change,
});

const refinementSection = (
  changes: Change[],
  includeDivider: boolean,
): ChangelogRefinementsNode | undefined => {
  const visible = visibleRefinements(changes);
  if (visible.length === 0) return undefined;

  const shown = visible.slice(0, maxInternalChangesToShow).map(refinementNode);
  const hidden = visible.slice(maxInternalChangesToShow);

  return {
    type: "refinements",
    includeDivider,
    children: shown,
    hiddenCount: hidden.length,
  };
};

const isCommitOnlyChange = (change: Change) =>
  Boolean(change.sourceCommit && change.number <= 0);

const primaryChangeNode = (change: Change): ChangelogChangeNode => ({
  type: "change",
  variant: isCommitOnlyChange(change) ? "refinement-commit" : "primary",
  change,
});

const buildPrimaryNodes = (api: Api, primaryChanges: Change[]): ChangelogNode[] => {
  const grouping = api.config.changelog?.grouping ?? "none";

  if (grouping === "none") {
    return primaryChanges.map(primaryChangeNode);
  }

  const groups = groupBy(({ type }) => type, primaryChanges);
  const sectionTitles = { ...api.config.changeTypes };

  return Object.entries(sectionTitles).flatMap(([changeType, label]) => {
    if (!isKey(groups, changeType)) return [];

    if (grouping === "package") {
      const byPkg = groupBy(
        (change: Change) => packageGroupKey(change.pkgs),
        groups[changeType],
      );

      const grouped = Object.entries(byPkg).map(([key, changes]) => ({
        type: "group" as const,
        key,
        title: key,
        children: changes.map(primaryChangeNode),
      }));

      return {
        type: "section" as const,
        changeType,
        label,
        children: grouped,
      };
    }

    return {
      type: "section" as const,
      changeType,
      label,
      children: groups[changeType].map(primaryChangeNode),
    };
  });
};

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

    const header = {
      type: "header" as const,
      version: tag.toString(),
      previousTag,
      releaseDate: releaseDate || getDate(),
    };

    if (primaryChanges.length === 0 && refinements.length === 0) {
      return {
        type: "document",
        children: [
          header,
          {
            type: "empty",
            message: "_No user-facing changes since the last tag._",
          },
        ],
      };
    }

    if (primaryChanges.length === 0 && refinements.length > 0) {
      const refinementsNode = refinementSection(refinements, false);
      if (!refinementsNode) {
        return {
          type: "document",
          children: [
            header,
            {
              type: "empty",
              message: "_No user-facing changes since the last tag._",
            },
          ],
        };
      }

      return {
        type: "document",
        children: [header, refinementsNode],
      };
    }

    const nodes: ChangelogNode[] = [
      header,
      {
        type: "summary",
        bump: detectBump(this.api, primaryChanges),
        changeCount: primaryChanges.length,
        packageCount: new Set(primaryChanges.flatMap((change) => change.pkgs))
          .size,
      },
      { type: "divider" },
      ...buildPrimaryNodes(this.api, primaryChanges),
    ];

    const refinementsNode = refinementSection(refinements, true);
    if (refinementsNode) {
      nodes.push(refinementsNode);
    }

    return { type: "document", children: nodes };
  }
}
