import { setFailed } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { Relasy, Label, createLabel } from "@relasy/core";

const { owner, repo } = context.repo;

async function run() {
  try {
    const relasy = await Relasy.load();
    const octokit = getOctokit(process.env.GITHUB_TOKEN || "");

    const labels = await octokit.paginate(
      octokit.rest.issues.listLabelsForRepo,
      {
        owner,
        repo,
        per_page: 100,
      }
    );

    Promise.all(
      relasy.labels(labels.map((l) => l.name)).map(async (label) => {
        console.log(`Processing label: ${label.name}`);

        if (label?.existing) {
          return octokit.rest.issues.updateLabel({
            owner,
            repo,
            name: label.existing,
            color: label.color,
            description: label.description,
            new_name: label.name,
          });
        }

        await octokit.rest.issues.createLabel({
          owner,
          repo,
          name: label.name,
          color: label.color,
          description: label.description,
        });
      })
    );
  } catch (error) {
    if (error instanceof Error) {
      setFailed(error.message);
    } else {
      setFailed(String(error));
    }
  }
}

if (require.main === module) {
  run();
}
