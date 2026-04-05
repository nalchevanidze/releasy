const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getErrorStatus = (error: unknown): number | undefined =>
  typeof error === "object" && error !== null && "status" in error
    ? (error as { status?: number }).status
    : undefined;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const isRetryableStatus = (status?: number) =>
  status === 429 || (status !== undefined && status >= 500);

export const withRetry = async <T>(
  label: string,
  fn: () => Promise<T>,
  attempts: number = 3,
): Promise<T> => {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const status = getErrorStatus(error);
      const retryable = isRetryableStatus(status);

      if (!retryable || attempt === attempts) {
        throw new Error(
          `${label} failed after ${attempt} attempt(s): ${getErrorMessage(error)}`,
        );
      }

      console.log(
        `[retry] ${label}: retrying attempt ${attempt + 1}/${attempts}`,
      );
      await sleep(300 * attempt);
    }
  }

  throw new Error(`${label} failed: exhausted retries`);
};
