import type { IRelasy } from "../index";
import { Result, fail, ok } from "./result";

type IRelasyLabelCheck = Pick<IRelasy, "parseLabels" | "config">;

export const checkLabels = (
  iRelasy: IRelasyLabelCheck,
  labels: string[],
  requireChangeType: boolean,
): Result<{ changeType: string }> => {
  try {
    const { changeTypes } = iRelasy.parseLabels(labels);

    if (requireChangeType && changeTypes.length === 0) {
      return fail(
        "LABEL_POLICY_ERROR",
        `PR is missing a change type label. Expected one of: ${Object.keys(
          iRelasy.config.changeTypes,
        ).join(", ")}`,
      );
    }

    if (changeTypes.length > 1) {
      return fail(
        "LABEL_POLICY_ERROR",
        `PR has multiple change type labels. Expected only one of: ${Object.keys(
          iRelasy.config.changeTypes,
        ).join(", ")}`,
      );
    }

    return ok({ changeType: changeTypes[0]?.changeType ?? "" });
  } catch (error) {
    return fail(
      "LABEL_POLICY_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
};
