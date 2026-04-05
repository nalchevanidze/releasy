import { pluck } from "ramda";
import { Change, Api, Commit, PR } from "./types";
import { parseLabels } from "../labels";
import { Version } from "../version";
import { commitsAfterVersion } from "../git";

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
  const commitNodes = pr.commits?.nodes ?? [];
  const detected = commitNodes
    .map(({ commit }) =>
      parseConventionalType(
        `${commit.messageHeadline || ""}\n${commit.messageBody || ""}`,
        Object.keys(api.config.changeTypes),
      ),
    )
    .filter((x): x is string => Boolean(x));

  if (detected.length > 0) {
    return highestDetectedType(api, detected);
  }

  // fallback for compatibility when commit payload is unavailable
  return parseConventionalType(
    `${pr.title}\n${pr.body || ""}`,
    Object.keys(api.config.changeTypes),
  );
};

const resolveDetectedType = (
  api: Api,
  labelsType?: string,
  commitsType?: string,
): string => {
  const detectionUse = api.config.policies?.detectionUse ?? ["labels"];
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
    if (source === "labels" && labelsType) return labelsType;
    if (source === "commits" && commitsType) return commitsType;
  }

  return labelsType || commitsType || "chore";
};

const toSyntheticChange = (api: Api, commit: Commit): Change => {
  const [title, ...bodyLines] = commit.message.split("\n");
  const body = bodyLines.join("\n").trim();
  const authorLogin =
    commit.author?.user?.login || commit.author?.name || "unknown";
  const authorUrl = commit.author?.user?.url || "";
  const commitDetected = parseConventionalType(
    commit.message,
    Object.keys(api.config.changeTypes),
  );

  return {
    number: 0,
    title: title.trim() || `Commit ${commit.oid.slice(0, 7)}`,
    body,
    author: { login: authorLogin, url: authorUrl },
    labels: { nodes: [] },
    type: (commitDetected || "chore") as Change["type"],
    pkgs: [],
    sourceCommit: commit.oid,
  };
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

    return {
      ...pr,
      type: resolveDetectedType(
        this.api,
        fromLabels,
        fromCommits,
      ) as Change["type"],
      pkgs: pkgs.map(({ pkg }) => pkg),
    };
  };

  public changes = async (version: Version): Promise<Change[]> => {
    const commits = await this.commits(commitsAfterVersion(version));
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
      .map((r) => r.commit);

    const prChanges = (await this.pullRequests(prNumbers)).map(this.toChange);

    const commitsEnabled = (
      this.api.config.policies?.detectionUse ?? ["labels"]
    ).includes("commits");

    if (!commitsEnabled || nonPrCommits.length === 0) {
      return prChanges;
    }

    const rule = this.api.config.policies?.rules?.nonPrCommit ?? "skip";

    if (rule === "error") {
      const examples = nonPrCommits
        .slice(0, 3)
        .map((c) => c.oid.slice(0, 7))
        .join(", ");

      throw new Error(
        `Found ${nonPrCommits.length} commits without associated PRs (examples: ${examples}). Adjust policies.rules.non-pr-commit to warn or skip to continue.`,
      );
    }

    if (rule === "skip") {
      return prChanges;
    }

    this.api.logger.warn(
      `[relasy] Including ${nonPrCommits.length} commits without PR linkage due to policies.rules.non-pr-commit=warn`,
    );

    const syntheticChanges = nonPrCommits.map((c) =>
      toSyntheticChange(this.api, c),
    );
    return [...prChanges, ...syntheticChanges];
  };
}
