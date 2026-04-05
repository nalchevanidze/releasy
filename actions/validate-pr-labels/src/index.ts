import { setFailed, getInput, setOutput, info } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import {
  formatActionFailure,
  requireGitHubToken,
  resolvePrNumber,
  resolveRepo,
} from "@relasy/actions-common";
import {
  checkLabels,
  evaluatePackageScopeRules,
  loadRelasy,
} from "@relasy/core";

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
    return (prFromPayload.labels ?? [])
      .map(toLabelName)
      .filter(Boolean) as string[];
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

export async function getCurrentPrFiles(
  params: Params = {},
): Promise<string[]> {
  const token = params.token ?? requireGitHubToken();
  const { owner, repo } = resolveRepo(context);
  const prNumber = resolvePrNumber(context);
  const octokit = getOctokit(token);

  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });

  return files.map((f) => f.filename);
}

const isDryRun = () => process.env.RELASY_DRY_RUN === "true";

const addPackageLabels = async (labelsToAdd: string[]) => {
  if (labelsToAdd.length === 0) return;

  if (isDryRun()) {
    info(
      `[relasy][dry-run] Would add inferred package labels: ${labelsToAdd.join(", ")}`,
    );
    return;
  }

  const token = requireGitHubToken();
  const { owner, repo } = resolveRepo(context);
  const prNumber = resolvePrNumber(context);
  const octokit = getOctokit(token);

  await octokit.rest.issues.addLabels({
    owner,
    repo,
    issue_number: prNumber,
    labels: labelsToAdd,
  });
};

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

    const autoAddInput = getInput("auto_add_package_labels", {
      required: false,
    });

    const autoAddPackageLabels =
      autoAddInput === ""
        ? (iRelasy.config.policies?.autoAddInferredPackages ?? false)
        : autoAddInput === "true";

    let labels = await getCurrentPrLabels();
    const changedFiles = await getCurrentPrFiles();

    const labelResult = checkLabels(
      iRelasy,
      labels,
      requireChangeType,
      changedFiles,
    );
    if (!labelResult.ok) {
      throw new Error(`[${labelResult.code}] ${labelResult.message}`);
    }
    const scopeResult = evaluatePackageScopeRules(
      iRelasy,
      labels,
      changedFiles,
    );

    if (!scopeResult.ok) {
      const message = `[${scopeResult.code}] ${scopeResult.message}`;

      if (
        autoAddPackageLabels &&
        message.includes("Missing inferred package labels")
      ) {
        const labelsToAdd = scopeResult.message
          .replace("Missing inferred package labels: ", "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        info(
          `[relasy] Auto-adding inferred package labels: ${labelsToAdd.join(", ")}`,
        );
        await addPackageLabels(labelsToAdd);
        labels = await getCurrentPrLabels({ refetch: true });
      } else {
        throw new Error(message);
      }
    }

    const finalScopeResult = evaluatePackageScopeRules(
      iRelasy,
      labels,
      changedFiles,
    );
    if (!finalScopeResult.ok) {
      throw new Error(`[${finalScopeResult.code}] ${finalScopeResult.message}`);
    }

    setOutput("change_type", labelResult.data.changeType);
    setOutput(
      "inferred_package_labels",
      finalScopeResult.data.inferredScopes.join(","),
    );
    setOutput(
      "missing_package_labels",
      finalScopeResult.data.missingScopes.join(","),
    );
  } catch (error) {
    setFailed(formatActionFailure("validate-pr-labels", error));
  }
}

if (require.main === module) {
  run();
}
