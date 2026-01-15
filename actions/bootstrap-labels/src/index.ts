import { setFailed } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { Relasy } from "@relasy/core";

const { owner, repo } = context.repo;

type Label = {
  name: string;
  color: string; // hex without #
  description?: string;
  existingName?: string;
};

const COLORS: Record<string, string> = {
  major: "B60205", // red (GitHub danger)
  breaking: "B60205", // red (same as major)
  feature: "0E8A16", // green
  fix: "1D76DB", // blue
  minor: "D4DADF", // light gray
  chore: "D4DADF", // light gray
  pkg: "c2e0c6", // teal (package scope / grouping)
};

export const createLabel = (
  type: string,
  existing: Map<string, { name: string }>,
  name: string,
  longName: string
): Label => ({
  name: `${type}/${name}`,
  color: COLORS[name] || COLORS.pkg,
  description:
    type === "type"
      ? `Relasy type label for versioning & changelog: ${longName}`
      : `Relasy scope label for grouping changes: "${longName}"`,
  existingName: existing.has(`${type}/${name}`)
    ? existing.get(`${type}/${name}`)?.name
    : undefined,
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
    const existingLabels = await listExistingLabels(octokit);

    const changeTypes = Object.entries(relasy.config.changeTypes).map(
      ([name, longName]) => createLabel("type", existingLabels, name, longName)
    );
    const scopes = Object.entries(relasy.config.scopes).map(
      ([name, longName]) => createLabel("scope", existingLabels, name, longName)
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
