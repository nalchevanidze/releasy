import { isNil, map, pluck, reject, uniq } from "ramda";
import { Change, Api, Commit, PR } from "./types";
import { commitsAfter } from "../git";
import { ChangeType, Config, LabelType } from "../config";

const parseNumber = (msg: string) => {
  const num = / \(#(?<prNumber>[0-9]+)\)$/m.exec(msg)?.groups?.prNumber;
  return num ? parseInt(num, 10) : undefined;
};

const prefixMap = {
  changeTypes: "type",
  scopes: "scope",
};

export const parseLabel = <T extends LabelType>(
  config: Config,
  t: T,
  label: string
): keyof Config[T] | undefined => {
  const values: Record<string, unknown> = config[t];
  const [prefix, key, ...rest] = label.split("/");

  if (rest.length) {
    throw new Error(
      `invalid label ${label}. only one '/' is allowed in labels for ${t}`
    );
  }

  if (key === undefined) {
    if (values[prefix] && t === "changeTypes") return prefix as keyof Config[T];

    return undefined;
  }

  if (prefix !== prefixMap[t]) undefined;

  if (values[key]) return key as keyof Config[T];


  const fields = Object.keys(values).join(", ");

  throw new Error(
    `invalid label ${label}. key ${key} could not be found on object with fields: ${fields}`
  );
};

export const parseLabels = <T extends LabelType>(
  config: Config,
  t: T,
  labels: string[]
): Array<keyof Config[T]> =>
  labels
    .map((label) => parseLabel(config, t, label))
    .filter((x) => x !== undefined) as Array<keyof Config[T]>;

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
