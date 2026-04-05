import { setFailed, getInput, setOutput, info } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import {
  formatActionFailure,
  requireGitHubToken,
  resolvePrNumber,
  resolveRepo,
} from "@relasy/actions-common";
import { checkLabels, loadRelasy } from "@relasy/core";

type Params = {
  token?: string;
  refetch?: boolean;
};

type LabelLike = string | { name?: string } | null | undefined;

const toLabelName = (label: LabelLike): string | undefined => {
  if (typeof label === "string") {
    return label;
  }

  if (label && typeof label.name === "string") {
    return label.name;
  }

  return undefined;
};

export async function getCurrentPrLabels(
  params: Params = {},
): Promise<string[]> {
  const prFromPayload = context.payload.pull_request as
    | { labels?: LabelLike[] }
    | undefined;

  // 1) Fast path: use event payload (no API call)
  if (prFromPayload && !params.refetch) {
    return (prFromPayload.labels ?? []).map(toLabelName).filter(Boolean) as string[];
  }

  // 2) Fetch from API (latest state)
  const token = params.token ?? requireGitHubToken();

  const { owner, repo } = resolveRepo(context);
  const prNumber = resolvePrNumber(context);
  const octokit = getOctokit(token);

  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  return (pr.labels ?? []).map(toLabelName).filter(Boolean) as string[];
}

export async function run() {
  try {
    const headRef = context.payload.pull_request?.head?.ref;

    if (headRef?.startsWith("release-")) {
      info("[relasy] Skipping label validation for release branch PR");
      return;
    }

    const iRelasy = await loadRelasy();

    const requireChangeType =
      getInput("require_change_type", {
        required: false,
      }) === "true";

    const labels = await getCurrentPrLabels();
    const result = checkLabels(iRelasy, labels, requireChangeType);

    if (!result.ok) {
      throw new Error(`[${result.code}] ${result.message}`);
    }

    setOutput("change_type", result.data.changeType);
  } catch (error) {
    setFailed(formatActionFailure("validate-pr-labels", error));
  }
}

if (require.main === module) {
  run();
}
