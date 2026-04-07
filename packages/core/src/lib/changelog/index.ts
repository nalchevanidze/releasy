import { dateAtRef, lastTag, listTags } from "../git";
import { Version } from "../version";
import { FetchApi } from "./fetch";
import { RenderAPI } from "./render";
import { Api, Change } from "./types";

export type ChangelogOptions = {
  sinceTag?: string;
  sinceCommit?: string;
  all?: boolean;
};

const detectChangeType = (
  changes: Change[],
  changeTypeBumps: Record<string, "major" | "minor" | "patch">,
) => {
  const rank = { patch: 0, minor: 1, major: 2 } as const;

  const highest = changes.reduce<"major" | "minor" | "patch">(
    (current, change) => {
      const bump =
        changeTypeBumps[change.type] ??
        (change.type === "breaking"
          ? "major"
          : change.type === "feature"
            ? "minor"
            : "patch");
      return rank[bump] > rank[current] ? bump : current;
    },
    "patch",
  );

  return highest;
};

const enforceVersionTagRule = (api: Api, previousVersion: Version) => {
  try {
    previousVersion.isEqual(lastTag());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("No names found")) {
      // first release in repository (no tags yet)
      return;
    }

    const rule = api.config.policies?.rules?.versionTagMismatch ?? "error";
    const mismatchMessage = `package.json version must match the last git tag. Root cause: ${message}`;

    if (rule === "error") {
      throw new Error(`Unable to continue release. ${mismatchMessage}`);
    }

    if (rule === "warn") {
      api.logger.warn(
        `[relasy] Continuing despite version/tag mismatch because policies.rules.version-tag-mismatch=warn. ${mismatchMessage}`,
      );
    }
    // skip => continue silently
  }
};

const renderIncrementalChangelog = async (
  api: Api,
  options: ChangelogOptions,
): Promise<string> => {
  const fetch = new FetchApi(api);
  const renderer = new RenderAPI(api);
  const currentVersion = api.module.version();

  const sinceRef = options.sinceCommit || options.sinceTag;
  const changes = sinceRef
    ? await fetch.changesSinceRef(sinceRef)
    : await fetch.changes(currentVersion);

  if (!sinceRef) {
    await api.module.bump(
      detectChangeType(
        changes,
        (api.config?.changeTypeBumps ?? {}) as Record<
          string,
          "major" | "minor" | "patch"
        >,
      ),
    );

    return renderer.changes(
      api.module.version(),
      changes,
      currentVersion.toString(),
    );
  }

  return renderer.changes(currentVersion, changes, options.sinceTag);
};

const renderFullHistoryChangelog = async (api: Api): Promise<string> => {
  const tags = listTags();
  const fetch = new FetchApi(api);
  const renderer = new RenderAPI(api);

  if (tags.length === 0) {
    const currentVersion = api.module.version();
    const changes = await fetch.changes(currentVersion);

    return renderer.changes(currentVersion, changes);
  }

  const sections: string[] = [];

  for (let i = 0; i < tags.length; i += 1) {
    const tag = tags[i];
    const previousTag = i > 0 ? tags[i - 1] : undefined;
    const changes = await fetch.changesBetweenRefs(previousTag, tag);

    sections.push(
      renderer.changes(
        Version.parse(tag),
        changes,
        previousTag,
        dateAtRef(tag),
      ),
    );
  }

  return sections.reverse().join("\n\n");
};

export const renderChangelog = async (
  api: Api,
  options: ChangelogOptions = {},
) => {
  const hasCustomStart = Boolean(options.sinceTag || options.sinceCommit);

  if (options.all) {
    return renderFullHistoryChangelog(api);
  }

  if (hasCustomStart) {
    return renderIncrementalChangelog(api, options);
  }

  const previousVersion = api.module.version();
  enforceVersionTagRule(api, previousVersion);

  return renderIncrementalChangelog(api, options);
};
