import { lastTag } from "../git";
import { FetchApi } from "./fetch";
import { RenderAPI } from "./render";
import { Api, Change } from "./types";

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

export const renderChangelog = async (api: Api) => {
  const previousVersion = api.module.version();

  try {
    previousVersion.isEqual(lastTag());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("No names found")) {
      // first release in repository (no tags yet)
    } else {
      const rule = api.config.policies?.rules?.versionTagMismatch ?? "error";
      const mismatchMessage =
        `package.json version must match the last git tag. Root cause: ${message}`;

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
  }

  const changes = await new FetchApi(api).changes(previousVersion);

  await api.module.bump(
    detectChangeType(
      changes,
      (api.config?.changeTypeBumps ?? {}) as Record<
        string,
        "major" | "minor" | "patch"
      >,
    ),
  );

  return new RenderAPI(api).changes(
    api.module.version(),
    changes,
    previousVersion.toString(),
  );
};
