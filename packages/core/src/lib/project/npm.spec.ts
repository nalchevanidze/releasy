import fs from "node:fs";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  defaultBuildCommand,
  detectPackageManager,
  resolvePostBumpCommand,
} from "./npm";

describe("npm project command resolution", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("detects pnpm when pnpm lockfile exists", () => {
    vi.spyOn(fs, "existsSync").mockImplementation((path: fs.PathLike) =>
      String(path).includes("pnpm-lock.yaml"),
    );

    expect(detectPackageManager()).toBe("pnpm");
  });

  test("detects yarn when yarn lockfile exists and pnpm does not", () => {
    vi.spyOn(fs, "existsSync").mockImplementation((path: fs.PathLike) =>
      String(path).includes("yarn.lock"),
    );

    expect(detectPackageManager()).toBe("yarn");
  });

  test("defaults to npm when no lockfile is present", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);

    expect(detectPackageManager()).toBe("npm");
  });

  test("uses postBump command when provided", () => {
    expect(
      resolvePostBumpCommand({
        type: "npm",
        postBump: "custom post-bump",
      }),
    ).toBe("custom post-bump");
  });

  test("uses build command when postBump is not provided", () => {
    expect(
      resolvePostBumpCommand({
        type: "npm",
        build: "custom build",
      }),
    ).toBe("custom build");
  });

  test("maps default commands per package manager", () => {
    expect(defaultBuildCommand("pnpm")).toBe("pnpm run build");
    expect(defaultBuildCommand("yarn")).toBe("yarn build");
    expect(defaultBuildCommand("npm")).toBe("npm run build");
  });
});
