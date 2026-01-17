import { setFailed } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { Relasy } from "@relasy/core";

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
      },
    );

    const ls = labels.map((l) => l.name);

    console.log(`fetched labels: ${JSON.stringify(ls)}`);

    Promise.all(
      relasy.labels(ls).map(async (label) => {

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
      }),
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
