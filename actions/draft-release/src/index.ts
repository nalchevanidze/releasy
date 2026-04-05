import { info, setFailed, setOutput } from "@actions/core";
import { formatActionFailure } from "@relasy/actions-common";
import { buildReleasePlan, draftRelease, loadRelasy } from "@relasy/core";

export async function run() {
  try {
    const iRelasy = await loadRelasy();
    const plan = await buildReleasePlan(iRelasy);
    if (plan.ok) {
      info(
        `[relasy] plan: version=${plan.data.version}, baseBranch=${plan.data.baseBranch}, labelPolicy=${plan.data.labelPolicy}`,
      );
    }

    const result = await draftRelease(iRelasy);

    if (!result.ok) {
      throw new Error(`[${result.code}] ${result.message}`);
    }

    setOutput("version", result.data.version);
    setOutput("release_branch", result.data.releaseBranch);
    setOutput("pr_number", String(result.data.prNumber));
    setOutput("pr_url", result.data.prUrl);

    info(`[relasy] Draft release finished: ${result.data.prUrl}`);
  } catch (error: unknown) {
    setFailed(formatActionFailure("draft-release", error));
  }
}

if (require.main === module) {
  run();
}
