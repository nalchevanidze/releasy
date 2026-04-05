import { getErrorMessage } from "./errors";

export const logActionInfo = (action: string, message: string) => {
  console.log(`[relasy][${action}] ${message}`);
};

export const logActionDryRun = (action: string, message: string) => {
  console.log(`[relasy][${action}][dry-run] ${message}`);
};

export const formatActionFailure = (action: string, error: unknown) =>
  `[${action}] ${getErrorMessage(error)}`;
