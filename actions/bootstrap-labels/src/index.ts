import { setFailed, info } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { Relasy } from "@relasy/core";

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

const isDryRun = () => process.env.RELASY_DRY_RUN === "true";

async function run() {
  try {
    const relasy = await Relasy.load();
    const { owner, repo } = resolveRepo();
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
      throw new Error("Missing GITHUB_TOKEN.");
    }

    const octokit = getOctokit(token);

    const labels = await octokit.paginate(
      octokit.rest.issues.listLabelsForRepo,
      {
        owner,
        repo,
        per_page: 100,
      },
    );

    const existingLabelNames = labels.map((l) => l.name);
    const desiredLabels = relasy.labels(existingLabelNames);

    info(`fetched labels: ${JSON.stringify(existingLabelNames)}`);

    if (isDryRun()) {
      info(
        `[dry-run] Would reconcile ${desiredLabels.length} labels in ${owner}/${repo}`,
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
      `Label reconciliation finished. created=${created}, updated=${updated}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setFailed(`bootstrap-labels failed: ${message}`);
  }
}

if (require.main === module) {
  run();
}
