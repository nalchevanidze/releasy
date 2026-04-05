import { Octokit } from "@octokit/rest";
import { git, isUserSet } from "./git";
import { withRetry } from "./retry";
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

const isDryRun = () => process.env.RELASY_DRY_RUN === "true";

const defaultUser = {
  name: "github-actions[bot]",
  email: "41898282+github-actions[bot]@users.noreply.github.com",
};

export class Github {
  private org: string;
  private repo: string;
  private user: { name: string; email: string };
  private configuredBaseBranch?: string;
  private resolvedBaseBranch?: string;

  constructor(
    path: string,
    user: { name: string; email: string } = defaultUser,
    baseBranch?: string,
  ) {
    const [org, repo] = path.split("/");
    this.org = org;
    this.repo = repo;
    this.user = user;
    this.configuredBaseBranch = baseBranch;
  }

  private get path() {
    return `github.com/${this.org}/${this.repo}`;
  }

  private get octokit() {
    return new Octokit({ auth: token() });
  }

  private resolveBaseBranch = async (): Promise<string> => {
    if (this.configuredBaseBranch) return this.configuredBaseBranch;
    if (this.resolvedBaseBranch) return this.resolvedBaseBranch;

    const { data } = await withRetry("Resolve repository default branch", () =>
      this.octokit.rest.repos.get({ owner: this.org, repo: this.repo }),
    );

    this.resolvedBaseBranch = data.default_branch || "main";
    return this.resolvedBaseBranch;
  };

  public setup = () => {
    if (isUserSet()) return;

    git("config", "user.name", this.user.name);
    git("config", "user.email", this.user.email);
  };

  public isOwner = ({ nameWithOwner }: { nameWithOwner: string }) =>
    nameWithOwner === `${this.org}/${this.repo}`;

  public batch =
    <O>(f: (_: string | number) => string) =>
    async (items: Array<string | number>) => {
      const output = await Promise.all(
        chunks(items).map(async (chunk) => {
          const query = `query {
            repository(owner: "${this.org}", name: "${this.repo}") {
              ${chunk.map((n) => `item_${n}:${f(n)}`).join("\n")}
            }
          }`;

          const data = await withRetry("GitHub GraphQL batch", () =>
            this.octokit.graphql<{
              repository: Record<string, O | null>;
            }>(query),
          );

          return Object.values(data.repository);
        }),
      );

      return output.flat().filter(Boolean) as O[];
    };

  public issue = (n: number) => `https://${this.path}/issues/${n}`;

  public release = async (
    version: Version,
    body: string,
  ): Promise<{ data: { number: number; html_url: string } }> => {
    const name = `release-${version.toString()}`;
    const baseBranch = this.configuredBaseBranch || "main";

    if (isDryRun()) {
      console.log(
        `[relasy][dry-run] Would create or reuse release PR for branch ${name} (base=${baseBranch}) in ${this.org}/${this.repo}`,
      );

      return {
        data: {
          number: 0,
          html_url: `https://github.com/${this.org}/${this.repo}/pull/0`,
        },
      };
    }

    const resolvedBaseBranch = await this.resolveBaseBranch();

    const existing = await withRetry("Check existing release PR", async () => {
      const { data } = await this.octokit.rest.pulls.list({
        owner: this.org,
        repo: this.repo,
        state: "open",
        head: `${this.org}:${name}`,
        base: resolvedBaseBranch,
        per_page: 1,
      });

      return data[0];
    });

    if (existing) {
      console.log(`[relasy] Reusing existing release PR: ${existing.html_url}`);

      return {
        data: {
          number: existing.number,
          html_url: existing.html_url,
        },
      };
    }

    git("add", ".");
    git("status");

    try {
      git("commit", "-m", name);
    } catch {
      console.log(
        "[relasy] No new changes to commit before drafting release PR.",
      );
    }

    try {
      git("push", "origin", `HEAD:${name}`);
    } catch {
      // fallback for environments without preconfigured git credentials
      const encoded = Buffer.from(`x-access-token:${token()}`).toString(
        "base64",
      );

      git(
        "-c",
        `http.https://github.com/.extraheader=AUTHORIZATION: basic ${encoded}`,
        "push",
        `https://${this.path}.git`,
        `HEAD:${name}`,
      );
    }

    return withRetry("Create release PR", async () => {
      const pr = await this.octokit.rest.pulls.create({
        owner: this.org,
        repo: this.repo,
        head: name,
        draft: true,
        base: resolvedBaseBranch,
        title: `Publish Release ${version.toString()}`,
        body,
      });

      return {
        data: {
          number: pr.data.number,
          html_url: pr.data.html_url,
        },
      };
    });
  };
}
