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

const toSyntheticChange = (commit: Commit): Change => {
  const [title, ...bodyLines] = commit.message.split("\n");
  const body = bodyLines.join("\n").trim();
  const authorLogin = commit.author?.user?.login || commit.author?.name || "unknown";
  const authorUrl = commit.author?.user?.url || "";

  return {
    number: 0,
    title: title.trim() || `Commit ${commit.oid.slice(0, 7)}`,
    body,
    author: { login: authorLogin, url: authorUrl },
    labels: { nodes: [] },
    type: "chore",
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

    return {
      ...pr,
      type: changeTypes.find(Boolean)?.changeType ?? "chore",
      pkgs: pkgs.map(({ pkg }) => pkg),
    };
  };

  public changes = async (version: Version): Promise<Change[]> => {
    const commits = await this.commits(commitsAfterVersion(version));
    const resolutions = commits.map(this.toResolution);
    const prNumbers = [...new Set(
      resolutions
        .filter((r): r is Extract<CommitResolution, { kind: "pr" }> =>
          r.kind === "pr",
        )
        .map((r) => r.prNumber),
    )];

    const nonPrCommits = resolutions
      .filter((r): r is Extract<CommitResolution, { kind: "non-pr" }> =>
        r.kind === "non-pr",
      )
      .map((r) => r.commit);

    const policy = this.api.config.nonPrCommitsPolicy ?? "skip";

    if (policy === "strict-fail" && nonPrCommits.length > 0) {
      const examples = nonPrCommits
        .slice(0, 3)
        .map((c) => c.oid.slice(0, 7))
        .join(", ");

      throw new Error(
        `Found ${nonPrCommits.length} commits without associated PRs (examples: ${examples}). Set nonPrCommitsPolicy to "skip" or "include" to continue.`,
      );
    }

    const prChanges = (await this.pullRequests(prNumbers)).map(this.toChange);

    if (policy !== "include") {
      return prChanges;
    }

    const syntheticChanges = nonPrCommits.map(toSyntheticChange);
    return [...prChanges, ...syntheticChanges];
  };
}
