import { setFailed, getInput, setOutput, info } from "@actions/core";
import { Octokit } from "@octokit/rest";
import { context } from "@actions/github";
import {
  assertRepoAccess,
  formatActionFailure,
  getErrorStatus,
  logActionEvent,
  resolveRepo,
} from "@relasy/actions-common";
import { loadRelasy, withRetry } from "@relasy/core";

const getBody = (): string => {
  const inputBody = getInput("body", { required: false });

  if (inputBody && inputBody.trim().length > 0) {
    return inputBody;
  }

  return context.payload.pull_request?.body ?? "";
};

const isDryRun = () => process.env.RELASY_DRY_RUN === "true";

export async function run() {
  try {
    const iRelasy = await loadRelasy();
    const { owner, repo } = resolveRepo(context);
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    await assertRepoAccess(octokit, owner, repo);
    const version = iRelasy.version().toString();

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
      logActionEvent("publish-release", "release-reused", {
        owner,
        repo,
        id: existing.id,
      });
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
    logActionEvent("publish-release", "release-created", {
      owner,
      repo,
      id: data.id,
    });
  } catch (error) {
    const { owner, repo } = (() => {
      try {
        return resolveRepo(context);
      } catch {
        return { owner: "<unknown>", repo: "<unknown>" };
      }
    })();

    setFailed(
      formatActionFailure(
        "publish-release",
        `failed for ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }
}

if (require.main === module) {
  run();
}
