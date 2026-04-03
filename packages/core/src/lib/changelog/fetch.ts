import { isNil, map, pluck, reject, uniq } from "ramda";
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

export class FetchApi {
  constructor(private api: Api) {}

  private commits = this.api.github.batch<Commit>(
    (i) =>
      `object(oid: "${i}") {
      ... on Commit {
        message
        associatedPullRequests(first: 10) { 
          nodes {
            number
            repository { nameWithOwner }
          }
        }
      }
    }`,
  );

  private pullRequests = this.api.github.batch<PR>(
    (i) =>
      `pullRequest(number: ${i}) {
      number
      title
      body
      author { login url }
      labels(first: 10) { nodes { name } }
    }`,
  );

  private toPRNumber = (c: Commit): number | undefined =>
    c.associatedPullRequests.nodes.find(({ repository }) =>
      this.api.github.isOwner(repository),
    )?.number ?? parsePRNumberFromCommitMessage(c.message);

  public changes = (version: Version) =>
    this.commits(commitsAfterVersion(version))
      .then((c) => uniq(reject(isNil, c.map(this.toPRNumber))))
      .then(this.pullRequests)
      .then(
        map((pr): Change => {
          const { changeTypes, pkgs } = parseLabels(
            this.api.config,
            pluck("name", pr.labels.nodes),
          );

          return {
            ...pr,
            type: changeTypes.find(Boolean)?.changeType ?? "chore",
            pkgs: pkgs.map(({ pkg }) => pkg),
          };
        }),
      );
}
