export const getErrorStatus = (error: unknown): number | undefined =>
  typeof error === "object" && error !== null && "status" in error
    ? (error as { status?: number }).status
    : undefined;

export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
