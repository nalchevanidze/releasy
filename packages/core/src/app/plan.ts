import type { IRelasy } from "../index";
import { Result, fail, ok } from "./result";

type IRelasyPlan = Pick<IRelasy, "version" | "config">;
export type ReleasePlan = {
  version: string;
  baseBranch: string;
  labelPolicy: string;
};

export const buildReleasePlan = async (
  iRelasy: IRelasyPlan,
): Promise<Result<ReleasePlan>> => {
  try {
    return ok({
      version: iRelasy.version().toString(),
      baseBranch: iRelasy.config.project.baseBranch ?? "(auto-detect default branch)",
      labelPolicy: iRelasy.config.labelPolicy ?? "strict",
    });
  } catch (error) {
    return fail(
      "UNKNOWN_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }
};
