import { setFailed } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { Relasy, Label, createLabel } from "@relasy/core";

const { owner, repo } = context.repo;

function normalizeColor(color: string): string {
  return color.replace(/^#/, "").trim().toUpperCase();
}

export async function ensureLabel(
  octokit: ReturnType<typeof getOctokit>,
  label: Label
) {
  try {
    if (label.existingName) {
      await octokit.rest.issues.updateLabel({
        owner,
        repo,
        name: label.existingName,
        color: normalizeColor(label.color),
        description: label.description,
        new_name: label.name, // keep same, but explicit
      });
    }

    await octokit.rest.issues.createLabel({
      owner,
      repo,
      name: label.name,
      color: label.color,
      description: label.description,
    });
    return;
  } catch (e: any) {
    // If it was created concurrently, treat as unchanged
    throw e;
  }
}

async function run() {
  try {
    const relasy = await Relasy.load();
    const octokit = getOctokit(process.env.GITHUB_TOKEN || "");

    const labels = await octokit.paginate(
      octokit.rest.issues.listLabelsForRepo,
      {
        owner,
        repo,
        per_page: 100,
      }
    );

    // Map by name for quick lookup
    const map = new Map<string, { name: string }>();
    for (const l of labels) {
      const label = relasy.parseLabel(l.name);
      if (label) {
        map.set(l.name, label);
      }
    }

    const changeTypes = Object.entries(relasy.config.changeTypes).map(
      ([name, longName]) => createLabel("changeTypes", name, longName)
    );
    const scopes = Object.entries(relasy.config.scopes).map(
      ([name, longName]) => createLabel("scopes", name, longName)
    );

    Promise.all(
      [...changeTypes, ...scopes].map((label) => ensureLabel(octokit, label))
    );
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
