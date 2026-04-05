import { setFailed, getInput, setOutput, info } from "@actions/core";
import { Octokit } from "@octokit/rest";
import { context } from "@actions/github";
import { Relasy, withRetry } from "@relasy/core";

const resolveRepo = () => {
  const owner = context.repo.owner || process.env.RELASY_OWNER;
  const repo = context.repo.repo || process.env.RELASY_REPO;

  if (!owner || !repo) {
    throw new Error(
      "Could not resolve owner/repo. Set RELASY_OWNER and RELASY_REPO for local runs.",
    );
  }

  return { owner, repo };
};

const getBody = (): string => {
  const inputBody = getInput("body", { required: false });

  if (inputBody && inputBody.trim().length > 0) {
    return inputBody;
  }

  return context.payload.pull_request?.body ?? "";
};

const isDryRun = () => process.env.RELASY_DRY_RUN === "true";

const getErrorStatus = (error: unknown): number | undefined =>
  typeof error === "object" && error !== null && "status" in error
    ? (error as { status?: number }).status
    : undefined;

export async function run() {
  try {
    const relasy = await Relasy.load();
    const { owner, repo } = resolveRepo();
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    const version = relasy.version().toString();

    if (isDryRun()) {
      info(
        `[relasy][dry-run] Would create or reuse release ${version} in ${owner}/${repo}`,
      );
      setOutput("id", "0");
      setOutput(
        "upload_url",
        `https://uploads.github.com/repos/${owner}/${repo}/releases/0/assets{?name,label}`,
      );
      return;
    }

    const existing = await withRetry("Get release by tag", async () => {
      try {
        const { data } = await octokit.repos.getReleaseByTag({
          owner,
          repo,
          tag: version,
        });

        return data;
      } catch (error: unknown) {
        if (getErrorStatus(error) === 404) {
          return undefined;
        }

        throw error;
      }
    });

    if (existing) {
      info(`[relasy] Release ${version} already exists: ${existing.html_url}`);
      setOutput("id", String(existing.id));
      setOutput("upload_url", existing.upload_url);
      return;
    }

    const { data } = await withRetry("Create release", () =>
      octokit.repos.createRelease({
        owner,
        repo,
        tag_name: version,
        name: version,
        body: getBody(),
      }),
    );

    setOutput("id", data.id);
    setOutput("upload_url", data.upload_url);
  } catch (error) {
    const { owner, repo } = (() => {
      try {
        return resolveRepo();
      } catch {
        return { owner: "<unknown>", repo: "<unknown>" };
      }
    })();

    const message = error instanceof Error ? error.message : String(error);
    setFailed(`publish-release failed for ${owner}/${repo}: ${message}`);
  }
}

if (require.main === module) {
  run();
}
