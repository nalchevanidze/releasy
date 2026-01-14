import { setFailed, getInput, setOutput } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { Relasy } from "@relasy/core";

type Params = {
  token?: string;
  refetch?: boolean;
};

const { owner, repo } = context.repo;

export async function getCurrentPrLabels(
  params: Params = {}
): Promise<string[]> {
  const prFromPayload = context.payload.pull_request as any | undefined;

  const toName = (l: any) => (typeof l === "string" ? l : l?.name);

  // 1) Fast path: use event payload (no API call)
  if (prFromPayload && !params.refetch) {
    return (prFromPayload.labels ?? []).map(toName).filter(Boolean);
  }

  // 2) Fetch from API (latest state)
  const token = params.token ?? process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      "No GitHub token provided. Pass `token` or set env GITHUB_TOKEN."
    );
  }

  const prNumber = prFromPayload?.number ?? context.issue.number;
  if (!prNumber) {
    throw new Error(
      "Could not determine PR number. Ensure this runs on a PR-related event."
    );
  }

  const octokit = getOctokit(token);

  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  return (pr.labels ?? []).map(toName).filter(Boolean);
}

async function run() {
  try {
    const relasy = await Relasy.load();

    const requireChangeType =
      getInput("require_change_type", {
        required: false,
      }) === "true";

    const labels = await getCurrentPrLabels();

    const changeTypes = relasy.parseLabels("changeTypes", labels);

    if (requireChangeType && changeTypes.length === 0) {
      throw new Error(
        `PR is missing a change type label. Expected one of: ${Object.keys(
          relasy.config.changeTypes
        ).join(", ")}`
      );
    }

    relasy.parseLabels("scopes", labels);
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
