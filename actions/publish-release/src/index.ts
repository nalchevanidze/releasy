import { setFailed, getInput, setOutput } from "@actions/core";
import { Octokit } from "@octokit/rest";
import { context } from "@actions/github";
import { Relasy } from "@relasy/core";

const { owner, repo } = context.repo;

// TODO: this action should only run if the PR is merged into main
// if: ${{ github.base_ref == 'main' && startsWith(github.head_ref, 'publish-release/') && github.event.pull_request.merged == true  }}

const getbody = (): string => {
  const inputBody = getInput("body", { required: false });

  if (inputBody && inputBody.trim().length > 0) {
    return inputBody;
  }

  return context.payload.pull_request?.body ?? "";
};

async function run() {
  try {
    const relasy = await Relasy.load();
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    const draft = getInput("draft", { required: false }) === "true";

    const version = relasy.version();

    const { data } = await octokit.repos.createRelease({
      owner,
      repo,
      tag_name: version,
      name: version,
      body: getbody(),
      draft,
    });

    setOutput("id", data.id);
    setOutput("upload_url", data.upload_url);
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
