import { groupBy } from "ramda";
import {
  CommitNode,
  ChangelogDocumentNode,
  ReleaseNode,
  HeaderNode,
  TitleNode,
  ChangeNode,
  LinkNode,
  ChangeTagNode,
  TextNode,
} from "./ast";
import { Version } from "../version";
import { Api, Change } from "./types";

export type Bump = "major" | "minor" | "patch";

const normalizedPkgs = (pkgs: string[]) => [...new Set(pkgs)].sort();

const changeTitle = (api: Api, change: Change) =>
  change.title?.trim() || api.config.changelog.untitledChangeMessage;

const shortCommit = (change: Change) =>
  change.sourceCommit?.slice(0, 7) ?? "unknown";

const primaryRefLabel = (change: Change) => {
  if (change.number > 0) return `#${change.number}`;
  if (change.sourceCommit) return shortCommit(change);
  return "unknown";
};

const authorInline = (change: Change): Array<TextNode | LinkNode> => {
  const login = change.author.login?.trim();
  if (!login || login.toLowerCase() === "unknown") return [];

  return change.author.url
    ? [{ type: "link", label: `@${login}`, url: change.author.url }]
    : [{ type: "text", value: `@${login}`, style: "plain" }];
};

const changeUrl = (api: Api, change: Change) => {
  if (change.sourceCommit) {
    return `https://github.com/${api.config.gh}/commit/${change.sourceCommit}`;
  }

  if (change.number > 0) {
    return api.github.issue(change.number);
  }

  return `https://github.com/${api.config.gh}`;
};

const itemHeader = (refLabel: string, title: string): TitleNode => ({
  type: "title",
  main: { type: "text", value: refLabel, style: "strong" },
  rest: [{ type: "text", value: title, style: "plain" }],
});

const scopeTag = (pkgs: string[]): ChangeTagNode | undefined => {
  const scope = normalizedPkgs(pkgs);
  if (scope.length === 0) return undefined;

  return {
    type: "tag",
    kind: "scope",
    children: scope.map((pkg) => ({
      type: "text",
      value: pkg,
      style: "literal",
    })),
  };
};

const authorTag = (
  authors: Array<TextNode | LinkNode>,
): ChangeTagNode | undefined => {
  if (authors.length === 0) return undefined;

  return {
    type: "tag",
    kind: "author",
    children: authors,
  };
};

const metadataTags = (change: Change): ChangeTagNode[] => {
  const tags: ChangeTagNode[] = [];

  const scope = scopeTag(change.pkgs);
  if (scope) tags.push(scope);

  const author = authorTag(authorInline(change));
  if (author) tags.push(author);

  return tags;
};

const item = (api: Api, change: Change): ChangeNode => ({
  type: "change",
  level: 1,
  header: itemHeader(primaryRefLabel(change), changeTitle(api, change)),
  children: metadataTags(change),
});

const commitItem = (api: Api, change: Change): CommitNode => ({
  type: "commit",
  ref: change.sourceCommit
    ? {
        type: "link",
        label: change.sourceCommit.slice(0, 7),
        url: changeUrl(api, change),
      }
    : undefined,
  title: changeTitle(api, change),
});

const isSyntheticCommit = (change: Change) =>
  Boolean(change.sourceCommit) && change.number <= 0;

const aggregatedAuthors = (commits: Change[]): Array<TextNode | LinkNode> => {
  const unique = new Map<string, TextNode | LinkNode>();

  commits
    .flatMap((change) => authorInline(change))
    .forEach((author) => {
      const key =
        author.type === "link"
          ? `link:${author.label}:${author.url}`
          : `text:${author.value}`;

      unique.set(key, author);
    });

  return [...unique.values()];
};

const unknownItem = (api: Api, commits: Change[]): ChangeNode => {
  const tags: ChangeTagNode[] = [];

  const scope = scopeTag(commits.flatMap((change) => change.pkgs));
  if (scope) tags.push(scope);

  const authors = authorTag(aggregatedAuthors(commits));
  if (authors) tags.push(authors);

  return {
    type: "change",
    level: 1,
    header: itemHeader(
      "Unknown",
      "Unrecognized commitlint items (no associated PR)",
    ),
    children: tags,
    commits: commits.map((change) => commitItem(api, change)),
  };
};

const sectionHeader = (
  api: Api,
  sectionId: string,
  sectionLabel: string,
): HeaderNode => ({
  type: "header",
  icon: api.config.changeTypeEmojis?.[sectionId],
  children: [{ type: "text", value: sectionLabel, style: "plain" }],
});

export type Release = {
  tag: Version;
  previousVersion?: Version;
  releaseDate: Date;
  changes: Change[];
};

export class ChangelogPlanner {
  constructor(private api: Api) {}

  private buildDocHeaders = (
    tag: Version,
    previousVersion: Version | undefined,
    releaseDate: Date,
  ): ReleaseNode["headers"] => {
    const version = tag.toString();

    const compareUrl = previousVersion
      ? `https://github.com/${this.api.config.gh}/compare/${previousVersion.toString()}...${version}`
      : undefined;

    const versionHeader: LinkNode | TextNode = compareUrl
      ? { type: "link", label: version, url: compareUrl }
      : { type: "text", value: version, style: "plain" };

    const dateHeader: ReleaseNode["headers"][number] = Number.isNaN(
      releaseDate.getTime(),
    )
      ? { type: "text", value: String(releaseDate), style: "plain" }
      : { type: "date", date: releaseDate };

    return [versionHeader, dateHeader];
  };

  private buildSections = (changes: Change[]): (ChangeNode | TextNode)[] => {
    const byType = groupBy(({ type }) => type, changes);

    const changeTypeEntries = Object.entries(
      this.api.config.changeTypes,
    ) as Array<[Change["type"], string]>;

    const sections = changeTypeEntries.flatMap(
      ([sectionId, sectionLabel]): ChangeNode[] => {
        const typedChanges: Change[] = byType[sectionId] ?? [];

        if (typedChanges.length === 0) {
          return [];
        }

        const standardItems = typedChanges
          .filter((change) => !isSyntheticCommit(change))
          .map((change) => item(this.api, change));

        const syntheticCommits = typedChanges.filter((change) =>
          isSyntheticCommit(change),
        );

        const children: ChangeNode[] = [...standardItems];

        if (syntheticCommits.length > 0) {
          children.push(unknownItem(this.api, syntheticCommits));
        }

        return [
          {
            type: "change",
            level: 0,
            header: sectionHeader(this.api, sectionId, sectionLabel),
            children,
          },
        ];
      },
    );

    return sections.length > 0
      ? sections
      : [
          {
            type: "text",
            value: this.api.config.changelog.noChangesMessage,
            style: "plain",
          },
        ];
  };

  public build = (release: Release): ReleaseNode => ({
    type: "release",
    headers: this.buildDocHeaders(
      release.tag,
      release.previousVersion,
      release.releaseDate,
    ),
    metrics: [
      {
        type: "metric",
        name: "bump",
        value: (release.previousVersion?.detectBump(release.tag) ??
          "patch") as Bump,
      },
      {
        type: "metric",
        name: "changes",
        value: String(release.changes.length),
      },
      {
        type: "metric",
        name: "packages",
        value: String(
          new Set(release.changes.flatMap((change) => change.pkgs)).size,
        ),
      },
    ],
    children: this.buildSections(release.changes),
  });

  public buildDocument = (releases: Release[]): ChangelogDocumentNode => ({
    type: "doc",
    releases: releases.map(this.build),
  });
}
