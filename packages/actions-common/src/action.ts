import { getErrorMessage } from "./errors";

export const logActionInfo = (action: string, message: string) => {
  console.log(`[relasy][${action}] ${message}`);
};

export const logActionDryRun = (action: string, message: string) => {
  console.log(`[relasy][${action}][dry-run] ${message}`);
};

export const logActionEvent = (
  action: string,
  event: string,
  fields: Record<string, string | number | boolean | undefined>,
) => {
  const payload = {
    scope: "relasy",
    action,
    event,
    ...fields,
  };

  console.log(`[relasy][event] ${JSON.stringify(payload)}`);
};

export const formatActionFailure = (action: string, error: unknown) =>
  `[${action}] ${getErrorMessage(error)}`;
