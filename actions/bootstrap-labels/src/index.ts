import { setFailed, info } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import {
  assertRepoAccess,
  formatActionFailure,
  requireGitHubToken,
  resolveRepo,
} from "@relasy/actions-common";
import { loadRelasy } from "@relasy/core";

const isDryRun = () => process.env.RELASY_DRY_RUN === "true";

export async function run() {
  try {
    const iRelasy = await loadRelasy();
    const { owner, repo } = resolveRepo(context);
    const token = requireGitHubToken();
    const octokit = getOctokit(token);
    await assertRepoAccess(
      octokit as {
        rest: { repos: { get: (args: { owner: string; repo: string }) => Promise<unknown> } };
      },
      owner,
      repo,
    );

    const labels = await octokit.paginate(
      octokit.rest.issues.listLabelsForRepo,
      {
        owner,
        repo,
        per_page: 100,
      },
    );

    const existingLabelNames = labels.map((l) => l.name);
    const desiredLabels = iRelasy.labels(existingLabelNames);

    info(`[relasy] fetched labels: ${JSON.stringify(existingLabelNames)}`);

    if (isDryRun()) {
      info(
        `[relasy][dry-run] Would reconcile ${desiredLabels.length} labels in ${owner}/${repo}`,
      );
      return;
    }

    let created = 0;
    let updated = 0;

    await Promise.all(
      desiredLabels.map(async (label) => {
        if (label?.existing) {
          updated += 1;

          return octokit.rest.issues.updateLabel({
            owner,
            repo,
            name: label.existing,
            color: label.color,
            description: label.description,
            new_name: label.name,
          });
        }

        created += 1;

        await octokit.rest.issues.createLabel({
          owner,
          repo,
          name: label.name,
          color: label.color,
          description: label.description,
        });
      }),
    );

    info(
      `[relasy] Label reconciliation finished. created=${created}, updated=${updated}`,
    );
  } catch (error) {
    setFailed(formatActionFailure("bootstrap-labels", error));
  }
}

if (require.main === module) {
  run();
}
