import { isNil, map, pluck, reject, uniq } from "ramda";
import { Change, Api, Commit, PR } from "./types";
import { commitsAfter } from "../git";
import { Config, LabelType } from "../config";

const parseNumber = (msg: string) => {
  const num = / \(#(?<prNumber>[0-9]+)\)$/m.exec(msg)?.groups?.prNumber;
  return num ? parseInt(num, 10) : undefined;
};

export const parseLabels = <T extends LabelType>(
  config: Config,
  t: T,
  labels: string[]
) =>
  labels.flatMap((label: string) => {
    const [prefix, key, ...rest] = label.split("/");

    if (prefix !== t) return [];

    const values: Record<string, unknown> = config[t];

    if (rest.length || !key || !values[key]) {
      const fields = Object.keys(values).join(", ");
      throw new Error(
        `invalid label ${label}. key ${key} could not be found on object with fields: ${fields}`
      );
    }

    return [key] as Array<keyof Config[T]>;
  });

export class FetchApi extends Api {
  private commits = this.github.batch<Commit>(
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
    }`
  );

  private pullRequests = this.github.batch<PR>(
    (i) =>
      `pullRequest(number: ${i}) {
      number
      title
      body
      author { login url }
      labels(first: 10) { nodes { name } }
    }`
  );

  private toPRNumber = (c: Commit): number | undefined =>
    c.associatedPullRequests.nodes.find(({ repository }) =>
      this.github.isOwner(repository)
    )?.number ?? parseNumber(c.message);

  public changes = (version: string) =>
    this.commits(commitsAfter(version))
      .then((c) => uniq(reject(isNil, c.map(this.toPRNumber))))
      .then(this.pullRequests)
      .then(
        map((pr): Change => {
          const labels = pluck("name", pr.labels.nodes);

          return {
            ...pr,
            type:
              parseLabels(this.config, "changeTypes", labels).find(Boolean) ??
              "chore",
            scopes: parseLabels(this.config, "scopes", labels),
          };
        })
      );
}
