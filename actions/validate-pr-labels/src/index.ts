import { setFailed, getInput, setOutput, info } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { Relasy } from "@relasy/core";

type Params = {
  token?: string;
  refetch?: boolean;
};

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

const resolvePrNumber = () => {
  const payloadPr = context.payload.pull_request?.number;
  const issuePr = context.issue.number;
  const envPr = process.env.RELASY_PR_NUMBER
    ? Number(process.env.RELASY_PR_NUMBER)
    : undefined;

  const number = payloadPr ?? issuePr ?? envPr;

  if (!number || Number.isNaN(number)) {
    throw new Error(
      "Could not determine PR number. Ensure PR event context exists or set RELASY_PR_NUMBER for local runs.",
    );
  }

  return number;
};

export async function getCurrentPrLabels(
  params: Params = {},
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
      "No GitHub token provided. Pass `token` or set env GITHUB_TOKEN.",
    );
  }

  const { owner, repo } = resolveRepo();
  const prNumber = resolvePrNumber();
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
    const headRef = context.payload.pull_request?.head?.ref;

    if (headRef?.startsWith("release-")) {
      info("Skipping label validation for release branch PR");
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

    setOutput("change_type", changeTypes[0] || "");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setFailed(`validate-pr-labels failed: ${message}`);
  }
}

if (require.main === module) {
  run();
}
