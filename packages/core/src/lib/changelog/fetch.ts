import { pluck } from "ramda";
import { Change, Api, Commit, PR } from "./types";
import { type Release, type Bump } from "./plan";
import { parseLabels } from "../labels";
import { Version } from "../version";
import {
  changedFilesAtCommit,
  commitsAfterRef,
  commitsAfterVersion,
  commitsBetweenRefs,
  dateAtRef,
  getDate,
  listTags,
} from "../git";

export const parsePRNumberFromCommitMessage = (
  msg: string,
): number | undefined => {
  const patterns = [
    /\(#(?<prNumber>[0-9]+)\)/m, // squash merge default
    /pull request #(?<prNumber>[0-9]+)/im,
    /\bPR\s*#(?<prNumber>[0-9]+)\b/im,
    /\B#(?<prNumber>[0-9]+)\b/m,
  ];

  for (const pattern of patterns) {
    const num = pattern.exec(msg)?.groups?.prNumber;

    if (num) {
      return parseInt(num, 10);
    }
  }

  return undefined;
};

type CommitResolution =
  | { kind: "pr"; prNumber: number; commit: Commit }
  | { kind: "non-pr"; commit: Commit };

type DetectionSource = "labels" | "commits";
const defaultDetectionUse: DetectionSource[] = ["labels"];
const defaultNonPrRule: "skip" | "warn" | "error" = "skip";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const globToRegExp = (glob: string): RegExp => {
  const normalized = glob.replace(/\\/g, "/");
  const pattern = normalized
    .split("**")
    .map((part) => part.split("*").map(escapeRegex).join("[^/]*"))
    .join(".*");
  return new RegExp(`^${pattern}$`);
};

const matchesAny = (path: string, patterns: string[]) => {
  const normalized = path.replace(/\\/g, "/");
  return patterns.some((pattern) => globToRegExp(pattern).test(normalized));
};

const inferPkgsFromPaths = (api: Api, changedFiles: string[]): string[] =>
  Object.entries(api.config.pkgs)
    .filter(([_, pkg]) => (pkg.paths ?? []).length > 0)
    .filter(([_, pkg]) =>
      changedFiles.some((file) => matchesAny(file, pkg.paths ?? [])),
    )
    .map(([pkg]) => pkg)
    .sort();

const toReleaseDate = (value: string): Date => new Date(`${value}T00:00:00Z`);

const detectBump = (
  changes: Change[],
  changeTypeBumps: Record<string, Bump>,
): Bump => {
  const rank = { patch: 0, minor: 1, major: 2 } as const;

  return changes.reduce<Bump>((current, change) => {
    const bump =
      changeTypeBumps[change.type] ??
      (change.type === "breaking"
        ? "major"
        : change.type === "feature"
          ? "minor"
          : "patch");
    return rank[bump] > rank[current] ? bump : current;
  }, "patch");
};

const nextVersionForBump = (currentVersion: Version, bump: Bump): Version => {
  const [majorRaw, minorRaw, patchRaw] = currentVersion.value
    .split(".")
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10));

  const major = Number.isNaN(majorRaw) ? 0 : majorRaw;
  const minor = Number.isNaN(minorRaw) ? 0 : minorRaw;
  const patch = Number.isNaN(patchRaw) ? 0 : patchRaw;

  if (bump === "major") return Version.parse(`${major + 1}.0.0`);
  if (bump === "minor") return Version.parse(`${major}.${minor + 1}.0`);
  return Version.parse(`${major}.${minor}.${patch + 1}`);
};

const releaseVersionPattern = "v?\\d+\\.\\d+\\.\\d+(?:[-+][\\w.-]+)?";
const releasePrTitleRegex = new RegExp(
  `^publish release\\s+${releaseVersionPattern}\\s*$`,
  "i",
);
const releaseBranchRegex = new RegExp(
  `^release-${releaseVersionPattern}$`,
  "i",
);
const releaseMergeCommitRegex = new RegExp(
  `^merge pull request #[0-9]+ from .+\/release-${releaseVersionPattern}\\b`,
  "i",
);

export const isReleasePr = (pr: PR): boolean => {
  const title = pr.title?.trim() || "";
  const branch = pr.headRefName?.trim() || "";

  return releasePrTitleRegex.test(title) && releaseBranchRegex.test(branch);
};

const isGeneratedReleasePr = (pr: PR): boolean => {
  const title = pr.title?.trim() || "";
  const body = pr.body?.trim() || "";

  return (
    isReleasePr(pr) ||
    releasePrTitleRegex.test(title) ||
    body.includes("<!-- relasy:release-pr -->")
  );
};

export const isReleaseCommit = (commit: Commit): boolean => {
  const title = (commit.message || "").split("\n")[0].trim();

  return (
    releasePrTitleRegex.test(title) ||
    releaseMergeCommitRegex.test(title) ||
    releaseBranchRegex.test(title)
  );
};

const availableChangeTypes = (api: Api) => Object.keys(api.config.changeTypes);

const parseConventionalType = (
  text: string,
  availableChangeTypes: string[],
): string | undefined => {
  const normalized = text.trim();
  if (!normalized) return undefined;

  const breakingByFooter = /(^|\n)BREAKING CHANGE:/m.test(normalized);
  const match = normalized.match(
    /^(?<type>[a-zA-Z]+)(\([^)]+\))?(?<breaking>!)?:/m,
  );

  if (breakingByFooter || match?.groups?.breaking) {
    return availableChangeTypes.includes("breaking") ? "breaking" : undefined;
  }

  const commitType = (match?.groups?.type || "").toLowerCase();
  const map: Record<string, string> = {
    feat: "feature",
    feature: "feature",
    fix: "fix",
    docs: "docs",
    test: "test",
    chore: "chore",
    refactor: "chore",
    perf: "chore",
    ci: "chore",
    build: "chore",
  };

  const mapped = map[commitType];
  return mapped && availableChangeTypes.includes(mapped) ? mapped : undefined;
};

const bumpRank = (bump: "major" | "minor" | "patch") =>
  bump === "major" ? 2 : bump === "minor" ? 1 : 0;

const bumpForChangeType = (
  api: Api,
  changeType: string,
): "major" | "minor" | "patch" =>
  api.config.changeTypeBumps?.[changeType] ??
  (changeType === "breaking"
    ? "major"
    : changeType === "feature"
      ? "minor"
      : "patch");

const highestDetectedType = (api: Api, types: string[]): string | undefined => {
  if (types.length === 0) return undefined;

  return [...new Set(types)].reduce((current, next) =>
    bumpRank(bumpForChangeType(api, next)) >
    bumpRank(bumpForChangeType(api, current))
      ? next
      : current,
  );
};

const detectTypeFromPRCommits = (api: Api, pr: PR): string | undefined => {
  const types = availableChangeTypes(api);
  const commitNodes = pr.commits?.nodes ?? [];
  const detected = commitNodes
    .map(({ commit }) =>
      parseConventionalType(
        `${commit.messageHeadline || ""}\n${commit.messageBody || ""}`,
        types,
      ),
    )
    .filter((x): x is string => Boolean(x));

  if (detected.length > 0) {
    return highestDetectedType(api, detected);
  }

  // fallback for compatibility when commit payload is unavailable
  return parseConventionalType(`${pr.title}\n${pr.body || ""}`, types);
};

const resolveDetectedType = (
  api: Api,
  labelsType?: string,
  commitsType?: string,
): { type: string; isRefinement: boolean } => {
  const detectionUse = api.config.policies?.detectionUse ?? defaultDetectionUse;
  const conflictRule = api.config.policies?.rules?.detectionConflict ?? "error";

  if (labelsType && commitsType && labelsType !== commitsType) {
    const message = `Detection conflict: labels resolved "${labelsType}" but commits resolved "${commitsType}".`;

    if (conflictRule === "error") {
      throw new Error(message);
    }

    if (conflictRule === "warn") {
      api.logger.warn(`[relasy] ${message}`);
    }
  }

  for (const source of detectionUse) {
    if (source === "labels" && labelsType) {
      return { type: labelsType, isRefinement: false };
    }

    if (source === "commits" && commitsType) {
      return { type: commitsType, isRefinement: false };
    }
  }

  if (labelsType || commitsType) {
    return { type: labelsType || commitsType || "chore", isRefinement: false };
  }

  return { type: "chore", isRefinement: true };
};

const commitsDetectionEnabled = (api: Api) =>
  (api.config.policies?.detectionUse ?? defaultDetectionUse).includes(
    "commits",
  );

const toSyntheticChange = (api: Api, commit: Commit): Change => {
  const [title, ...bodyLines] = commit.message.split("\n");
  const body = bodyLines.join("\n").trim();
  const authorLogin =
    commit.author?.user?.login || commit.author?.name || "unknown";
  const authorUrl = commit.author?.user?.url || "";
  const commitDetected = parseConventionalType(
    commit.message,
    availableChangeTypes(api),
  );
  const changedFiles = changedFilesAtCommit(commit.oid);

  return {
    number: 0,
    title: title.trim() || `Commit ${commit.oid.slice(0, 7)}`,
    body,
    author: { login: authorLogin, url: authorUrl },
    labels: { nodes: [] },
    type: (commitDetected || "chore") as Change["type"],
    pkgs: inferPkgsFromPaths(api, changedFiles),
    sourceCommit: commit.oid,
    isRefinement: !commitDetected,
  };
};

export type FetchReleasesOptions = {
  currentVersion: Version;
  sinceRef?: string;
  sinceTag?: string;
  all?: boolean;
};

export type FetchReleasePlanOptions = {
  currentVersion: Version;
  all?: boolean;
};

export type FetchPreviewReleaseOptions = {
  currentVersion: Version;
  sinceRef: string;
  sinceTag?: string;
};

export type ReleasePlan = {
  release: Release;
  bump: Bump;
};

export class FetchApi {
  constructor(private api: Api) {}

  private commits = (items: Array<string | number>) =>
    this.api.github.batch<Commit>(
      (i) =>
        `object(oid: "${i}") {
      ... on Commit {
        oid
        message
        author {
          name
          user { login url }
        }
        associatedPullRequests(first: 10) {
          nodes {
            number
            repository { nameWithOwner }
          }
        }
      }
    }`,
    )(items);

  private pullRequests = (items: Array<string | number>) =>
    this.api.github.batch<PR>(
      (i) =>
        `pullRequest(number: ${i}) {
      number
      title
      body
      headRefName
      author { login url }
      labels(first: 10) { nodes { name } }
      commits(first: 50) {
        nodes {
          commit {
            messageHeadline
            messageBody
          }
        }
      }
    }`,
    )(items);

  private toResolution = (c: Commit): CommitResolution => {
    const prNumber =
      c.associatedPullRequests.nodes.find(({ repository }) =>
        this.api.github.isOwner(repository),
      )?.number ?? parsePRNumberFromCommitMessage(c.message);

    if (prNumber) {
      return { kind: "pr", prNumber, commit: c };
    }

    return { kind: "non-pr", commit: c };
  };

  private toChange = (pr: PR): Change => {
    const { changeTypes, pkgs } = parseLabels(
      this.api.config,
      pluck("name", pr.labels.nodes),
    );

    const fromLabels = changeTypes.find(Boolean)?.changeType;
    const fromCommits = detectTypeFromPRCommits(this.api, pr);
    const detected = resolveDetectedType(this.api, fromLabels, fromCommits);

    return {
      ...pr,
      type: detected.type as Change["type"],
      isRefinement: detected.isRefinement,
      pkgs: pkgs.map(({ pkg }) => pkg),
    };
  };

  private resolveChangesFromCommits = async (
    commitOids: string[],
  ): Promise<Change[]> => {
    const commits = await this.commits(commitOids);
    const resolutions = commits.map(this.toResolution);
    const prNumbers = [
      ...new Set(
        resolutions
          .filter(
            (r): r is Extract<CommitResolution, { kind: "pr" }> =>
              r.kind === "pr",
          )
          .map((r) => r.prNumber),
      ),
    ];

    const nonPrCommits = resolutions
      .filter(
        (r): r is Extract<CommitResolution, { kind: "non-pr" }> =>
          r.kind === "non-pr",
      )
      .map((r) => r.commit)
      .filter((commit) => !isReleaseCommit(commit));

    const prChanges = (await this.pullRequests(prNumbers))
      .filter((pr) => !isGeneratedReleasePr(pr))
      .map(this.toChange);

    if (!commitsDetectionEnabled(this.api) || nonPrCommits.length === 0) {
      return prChanges;
    }

    const rule =
      this.api.config.policies?.rules?.nonPrCommit ?? defaultNonPrRule;

    if (rule === "skip") {
      return prChanges;
    }

    if (rule === "error") {
      const examples = nonPrCommits
        .slice(0, 3)
        .map((c) => c.oid.slice(0, 7))
        .join(", ");

      throw new Error(
        `Found ${nonPrCommits.length} commits without associated PRs (examples: ${examples}). Adjust policies.rules.non-pr-commit to warn or skip to continue.`,
      );
    }

    this.api.logger.warn(
      `[relasy] Including ${nonPrCommits.length} commits without PR linkage due to policies.rules.non-pr-commit=warn`,
    );

    return [
      ...prChanges,
      ...nonPrCommits.map((c) => toSyntheticChange(this.api, c)),
    ];
  };

  public currentRelease = async (
    currentVersion: Version,
  ): Promise<Release> => ({
    tag: currentVersion,
    changes: await this.changes(currentVersion),
    releaseDate: toReleaseDate(getDate()),
  });

  public previewRelease = async (
    options: FetchPreviewReleaseOptions,
  ): Promise<Release> => ({
    tag: options.currentVersion,
    changes: await this.changesSinceRef(options.sinceRef),
    releaseDate: toReleaseDate(getDate()),
    previousVersion: options.sinceTag
      ? Version.parse(options.sinceTag)
      : undefined,
  });

  public fetchReleases = async (
    options: FetchReleasesOptions,
  ): Promise<Release[]> => {
    if (options.all) {
      return this.fullHistoryReleases(options.currentVersion);
    }

    if (options.sinceRef) {
      return [
        await this.previewRelease({
          currentVersion: options.currentVersion,
          sinceRef: options.sinceRef,
          sinceTag: options.sinceTag,
        }),
      ];
    }

    return [await this.currentRelease(options.currentVersion)];
  };

  public fetchLastRelease = async (
    options: FetchReleasesOptions,
  ): Promise<Release | undefined> => {
    const releases = await this.fetchReleases(options);
    return releases[0];
  };

  public fetchReleasePlan = async (
    options: FetchReleasePlanOptions,
  ): Promise<ReleasePlan> => {
    const release = await this.currentRelease(options.currentVersion);
    const bump = detectBump(
      release.changes,
      (this.api.config?.changeTypeBumps ?? {}) as Record<string, Bump>,
    );

    return {
      release: {
        ...release,
        tag: nextVersionForBump(options.currentVersion, bump),
        previousVersion: options.currentVersion,
      },
      bump,
    };
  };

  public changes = async (version: Version): Promise<Change[]> =>
    this.resolveChangesFromCommits(commitsAfterVersion(version));

  public changesSinceRef = async (ref: string): Promise<Change[]> =>
    this.resolveChangesFromCommits(commitsAfterRef(ref));

  public changesBetweenRefs = async (
    fromExclusive: string | undefined,
    to: string,
  ): Promise<Change[]> =>
    this.resolveChangesFromCommits(commitsBetweenRefs(fromExclusive, to));

  public releasesByTags = async (tags: string[]): Promise<Release[]> =>
    Promise.all(
      tags.map(async (tag, i) => {
        const previousTag = i > 0 ? tags[i - 1] : undefined;
        const changes = await this.changesBetweenRefs(previousTag, tag);

        return {
          tag: Version.parse(tag),
          previousVersion: previousTag ? Version.parse(previousTag) : undefined,
          releaseDate: toReleaseDate(dateAtRef(tag)),
          changes,
        };
      }),
    );

  public fullHistoryReleases = async (
    currentVersion: Version,
  ): Promise<Release[]> => {
    const tags = listTags();

    if (tags.length === 0) {
      return [
        {
          tag: currentVersion,
          changes: await this.changes(currentVersion),
          releaseDate: toReleaseDate(getDate()),
        },
      ];
    }

    return (await this.releasesByTags(tags)).reverse();
  };
}
