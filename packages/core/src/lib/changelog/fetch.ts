import { isNil, map, pluck, reject, uniq } from "ramda";
import { Change, Api, Commit, PR } from "./types";
import { commitsAfter } from "../git";
import { parseLabels } from "../labels";

const parseNumber = (msg: string) => {
  const num = / \(#(?<prNumber>[0-9]+)\)$/m.exec(msg)?.groups?.prNumber;
  return num ? parseInt(num, 10) : undefined;
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
    )?.number ?? parseNumber(c.message);

  public changes = (version: string) =>
    this.commits(commitsAfter(version))
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
