import { setFailed, getInput, setOutput, info } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import {
  formatActionFailure,
  requireGitHubToken,
  resolvePrNumber,
  resolveRepo,
} from "@relasy/actions-common";
import { Relasy } from "@relasy/core";

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

    const relasy = await Relasy.load();

    const requireChangeType =
      getInput("require_change_type", {
        required: false,
      }) === "true";

    const labels = await getCurrentPrLabels();
    const { changeTypes } = relasy.parseLabels(labels);

    if (requireChangeType && changeTypes.length === 0) {
      throw new Error(
        `PR is missing a change type label. Expected one of: ${Object.keys(
          relasy.config.changeTypes,
        ).join(", ")}`,
      );
    }

    if (changeTypes.length > 1) {
      throw new Error(
        `PR has multiple change type labels. Expected only one of: ${Object.keys(
          relasy.config.changeTypes,
        ).join(", ")}`,
      );
    }

    setOutput("change_type", changeTypes[0]?.changeType ?? "");
  } catch (error) {
    setFailed(formatActionFailure("validate-pr-labels", error));
  }
}

if (require.main === module) {
  run();
}
