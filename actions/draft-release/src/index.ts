import { info, setFailed } from "@actions/core";
import { Relasy } from "@relasy/core";

async function run() {
  try {
    const easy = await Relasy.load();
    const body = await easy.changelog();
    await easy.module.postBump();
    easy.github.setup();
    await easy.github.release(await easy.module.version(), body);

    info("Draft release finished.");
  } catch (e: any) {
    setFailed(e?.message ?? String(e));
  }
}

if (require.main === module) {
  run();
}
