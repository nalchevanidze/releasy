import { info, setFailed, setOutput } from "@actions/core";
import { Relasy } from "@relasy/core";

async function run() {
  try {
    const relasy = await Relasy.load();
    const body = await relasy.changelog();

    await relasy.module.postBump();
    relasy.github.setup();

    const version = relasy.module.version();
    const branch = `release-${version.toString()}`;
    const pr = await relasy.github.release(version, body);

    setOutput("version", version.toString());
    setOutput("release_branch", branch);
    setOutput("pr_number", String(pr.data.number));
    setOutput("pr_url", pr.data.html_url);

    info(`Draft release finished: ${pr.data.html_url}`);
  } catch (e: any) {
    setFailed(e?.message ?? String(e));
  }
}

if (require.main === module) {
  run();
}
