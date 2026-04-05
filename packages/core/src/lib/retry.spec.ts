import { describe, expect, test, vi } from "vitest";
import { withRetry } from "./retry";

describe("withRetry failure modes", () => {
  test("retries transient 500 and succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ status: 500, message: "server error" })
      .mockResolvedValueOnce("ok");

    await expect(withRetry("transient", fn, 2)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test("does not retry non-retryable errors", async () => {
    const fn = vi.fn().mockRejectedValue({ status: 400, message: "bad request" });

    await expect(withRetry("bad-request", fn, 3)).rejects.toThrow(
      "bad-request failed after 1 attempt",
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("fails after exhausting retries", async () => {
    const fn = vi.fn().mockRejectedValue({ status: 503, message: "unavailable" });

    await expect(withRetry("exhaust", fn, 2)).rejects.toThrow(
      "exhaust failed after 2 attempt",
    );
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
