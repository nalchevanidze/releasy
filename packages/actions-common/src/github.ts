export type RepoContext = {
  repo: { owner?: string; repo?: string };
  issue?: { number?: number };
  payload?: { pull_request?: { number?: number } };
};

export const resolveRepo = (
  context: RepoContext,
  env: NodeJS.ProcessEnv = process.env,
) => {
  const owner = context.repo.owner || env.RELASY_OWNER;
  const repo = context.repo.repo || env.RELASY_REPO;

  if (!owner || !repo) {
    throw new Error(
      "Could not resolve owner/repo. Set RELASY_OWNER and RELASY_REPO for local runs.",
    );
  }

  return { owner, repo };
};

export const resolvePrNumber = (
  context: RepoContext,
  env: NodeJS.ProcessEnv = process.env,
) => {
  const payloadPr = context.payload?.pull_request?.number;
  const issuePr = context.issue?.number;
  const envPr = env.RELASY_PR_NUMBER ? Number(env.RELASY_PR_NUMBER) : undefined;

  const number = payloadPr ?? issuePr ?? envPr;

  if (!number || Number.isNaN(number)) {
    throw new Error(
      "Could not determine PR number. Ensure PR event context exists or set RELASY_PR_NUMBER for local runs.",
    );
  }

  return number;
};

export const requireGitHubToken = (
  env: NodeJS.ProcessEnv = process.env,
): string => {
  const token = env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("Missing GITHUB_TOKEN.");
  }

  return token;
};

export const assertRepoAccess = async (
  octokit: {
    rest: {
      repos: { get: (args: { owner: string; repo: string }) => Promise<unknown> };
    };
  },
  owner: string,
  repo: string,
) => {
  try {
    await octokit.rest.repos.get({ owner, repo });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Token preflight failed for ${owner}/${repo}. Ensure workflow permissions and token scopes allow repository access. Root cause: ${message}`,
    );
  }
};
