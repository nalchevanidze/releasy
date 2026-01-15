import { setFailed } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { Relasy } from "@relasy/core";

const { owner, repo } = context.repo;

type Label = {
  name: string;
  color: string; // hex without #
  description?: string;
  existing?: boolean;
};

const COLORS: Record<string, string> = {
  breaking: "B60205", // red
  feature: "0E8A16", // green
  fix: "1D76DB", // blue
  minor: "FBCA04", // yellow
};

export const createLabel = (
  type: string,
  existing: Map<string, unknown>,
  name: string
): Label => ({
  name: `${type}/${name}`,
  color: COLORS[name] || "C5DEF5",
  description: `Relasy ${type} label: ${name}`,
  existing: existing.has(`${type}/${name}`),
});

function normalizeColor(color: string): string {
  return color.replace(/^#/, "").trim().toUpperCase();
}

export async function listExistingLabels(
  octokit: ReturnType<typeof getOctokit>
) {
  const labels = await octokit.paginate(octokit.rest.issues.listLabelsForRepo, {
    owner,
    repo,
    per_page: 100,
  });

  // Map by name for quick lookup
  const map = new Map<
    string,
    { name: string; color: string; description: string | null | undefined }
  >();

  for (const l of labels) {
    map.set(l.name, {
      name: l.name,
      color: (l.color || "").toUpperCase(),
      description: l.description,
    });
  }

  return map;
}

export async function ensureLabel(
  octokit: ReturnType<typeof getOctokit>,
  label: Label
) {
  if (!label.existing) {
    try {
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

  await octokit.rest.issues.updateLabel({
    owner,
    repo,
    name: label.name, // current label name
    color: normalizeColor(label.color),
    description: label.description,
    new_name: label.name, // keep same, but explicit
  });
}

async function run() {
  try {
    const relasy = await Relasy.load();
    const octokit = getOctokit(process.env.GITHUB_TOKEN || "");
    const existingLabels = await listExistingLabels(octokit);

    const changeTypes = Object.keys(relasy.config.changeTypes).map((name) =>
      createLabel("type", existingLabels, name)
    );
    const scopes = Object.keys(relasy.config.scopes).map((name) =>
      createLabel("scope", existingLabels, name)
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
