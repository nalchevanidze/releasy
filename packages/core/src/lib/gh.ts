import axios from "axios";
import { git, isUserSet } from "./git";
import { Version } from "./version";

export const chunks = <T>(xs: T[]): T[][] => {
  const batches: T[][] = [];

  for (let i = 0; i < xs.length; i += 50) {
    const batch = xs.slice(i, i + 50);
    batches.push(batch);
  }

  return batches;
};

const token = () => {
  const { GITHUB_TOKEN } = process.env;

  if (!GITHUB_TOKEN) {
    throw new Error("missing variable: GITHUB_TOKEN");
  }
  return GITHUB_TOKEN;
};

const gh = (path: string, body: {}) =>
  axios
    .post(`https://api.github.com/${path}`, JSON.stringify(body), {
      headers: {
        authorization: `Bearer ${token()}`,
        "content-type": "application/json",
        accept: "Accept: application/vnd.github.v3+json",
      },
    })
    .then(({ data }) => data.data)
    .catch((err) => Promise.reject(err.message));

const defaultUser = {
  name: "github-actions[bot]",
  email: "41898282+github-actions[bot]@users.noreply.github.com",
};

export class Github {
  private org: string;
  private repo: string;
  private user: { name: string; email: string };

  constructor(
    path: string,
    user: { name: string; email: string } = defaultUser,
  ) {
    const [org, repo] = path.split("/");
    this.org = org;
    this.repo = repo;
    this.user = user;
  }

  private get path() {
    return `github.com/${this.org}/${this.repo}`;
  }

  public setup = () => {
    if (isUserSet()) return;

    git("config", "user.name", `"${this.user.name}"`);
    git("config", "user.email", `"${this.user.email}"`);
  };

  public isOwner = ({ nameWithOwner }: { nameWithOwner: string }) =>
    nameWithOwner === `${this.org}/${this.repo}`;

  public batch =
    <O>(f: (_: string | number) => string) =>
    (items: Array<string | number>) =>
      Promise.all(
        chunks(items).map((chunk) =>
          gh("graphql", {
            query: `{
          repository(owner: "${this.org}", name: "${this.repo}") {
          ${chunk.map((n) => `item_${n}:${f(n)}`).join("\n")}
        }
      }`,
          }).then(({ repository }) => Object.values(repository)),
        ),
      ).then((x) => x.flat().filter(Boolean) as O[]);

  public issue = (n: number) => `https://${this.path}/issues/${n}`;

  public release = async (version: Version, body: string) => {
    const name = `release-${version.toString()}`;

    git("add", ".");
    git("status");
    git("commit", "-m", `"${name}"`);
    git("push", `https://${token()}@${this.path}.git`, `HEAD:${name}`);

    return gh(`repos/${this.org}/${this.repo}/pulls`, {
      head: name,
      draft: true,
      base: "main",
      owner: this.org,
      repo: this.repo,
      title: `Publish Release ${version.toString()}`,
      body,
    });
  };
}
