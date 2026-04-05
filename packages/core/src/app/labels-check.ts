import type { IRelasy } from "../index";
import { Result, fail, ok } from "./result";

type IRelasyLabelCheck = Pick<IRelasy, "parseLabels" | "config">;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const globToRegExp = (glob: string): RegExp => {
  const normalized = glob.replace(/\\/g, "/");
  const pattern = normalized
    .split("**")
    .map((part) => part.split("*").map(escapeRegex).join("[^/]*"))
    .join(".*");
  return new RegExp(`^${pattern}$`);
};

const inferChangeTypeFromFiles = (
  changedFiles: string[],
  scopes: NonNullable<IRelasyLabelCheck["config"]["changeTypeScopes"]>,
): string | undefined => {
  for (const [changeType, scope] of Object.entries(scopes)) {
    const matched = changedFiles.some((file) =>
      scope.paths.some((pattern) => globToRegExp(pattern).test(file.replace(/\\/g, "/"))),
    );

    if (matched) return changeType;
  }

  return undefined;
};

export const checkLabels = (
  iRelasy: IRelasyLabelCheck,
  labels: string[],
  requireChangeType: boolean,
  changedFiles: string[] = [],
): Result<{ changeType: string }> => {
  try {
    const { changeTypes } = iRelasy.parseLabels(labels);

    if (changeTypes.length > 1) {
      return fail(
        "LABEL_POLICY_ERROR",
        `PR has multiple change type labels. Expected only one of: ${Object.keys(
          iRelasy.config.changeTypes,
        ).join(", ")}`,
      );
    }

    const explicit = changeTypes[0]?.changeType;
    const inferred = iRelasy.config.changeTypeScopes
      ? inferChangeTypeFromFiles(changedFiles, iRelasy.config.changeTypeScopes)
      : undefined;

    const resolved = explicit || inferred || "";

    if (requireChangeType && !resolved) {
      return fail(
        "LABEL_POLICY_ERROR",
        `PR is missing a change type label. Expected one of: ${Object.keys(
          iRelasy.config.changeTypes,
        ).join(", ")}`,
      );
    }

    return ok({ changeType: resolved });
  } catch (error) {
    return fail(
      "LABEL_POLICY_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
};
