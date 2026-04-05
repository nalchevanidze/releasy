import { describe, expect, test, vi } from "vitest";
import {
  formatActionFailure,
  logActionDryRun,
  logActionEvent,
  logActionInfo,
} from "./action";

describe("actions-common action helpers", () => {
  test("formats failures with action prefix", () => {
    expect(formatActionFailure("publish-release", new Error("boom"))).toBe(
      "[publish-release] boom",
    );
  });

  test("logs with standard prefixes", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    logActionInfo("draft-release", "started");
    logActionDryRun("publish-release", "would create release");
    logActionEvent("publish-release", "release-created", {
      repo: "acme/demo",
      id: 1,
      dryRun: false,
    });

    expect(spy).toHaveBeenCalledWith("[relasy][draft-release] started");
    expect(spy).toHaveBeenCalledWith(
      "[relasy][publish-release][dry-run] would create release",
    );
    expect(spy).toHaveBeenCalledWith(
      '[relasy][event] {"scope":"relasy","action":"publish-release","event":"release-created","repo":"acme/demo","id":1,"dryRun":false}',
    );

    spy.mockRestore();
  });
});
