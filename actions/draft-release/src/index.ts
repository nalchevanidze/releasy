import * as core from "@actions/core";
import { Relasy } from "@relasy/core";

async function run() {
  try {
    const token = process.env.GITHUB_TOKEN || process.env.GITHUB_API_TOKEN;
    if (!token) throw new Error("Missing GITHUB_TOKEN (or GITHUB_API_TOKEN).");

    // provide both names for compatibility
    process.env.GITHUB_TOKEN = process.env.GITHUB_TOKEN || token;
    process.env.GITHUB_API_TOKEN = process.env.GITHUB_API_TOKEN || token;

    // run in the checked-out repo
    const cwd = process.env.GITHUB_WORKSPACE || process.cwd();
    process.chdir(cwd);

    const easy = await Relasy.load();

    await easy.release();

    core.info("Draft release finished.");
  } catch (e: any) {
    core.setFailed(e?.message ?? String(e));
  }
}

run();
