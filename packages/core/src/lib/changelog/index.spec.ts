import { describe, expect, test, vi, beforeEach } from "vitest";
import { Changelog } from "./index";
import type { Api } from "./types";

const mockLastTag = vi.fn();
const mockFetchReleasePlan = vi.fn();
const mockPreviewRelease = vi.fn();
const mockReleases = vi.fn();
const mockDocuments = vi.fn();

vi.mock("../git", () => ({
  lastTag: () => mockLastTag(),
}));

vi.mock("./fetch", () => ({
  FetchApi: class {
    fetchReleasePlan(options: unknown) {
      return mockFetchReleasePlan(options);
    }

    previewRelease(options: unknown) {
      return mockPreviewRelease(options);
    }

    fetchReleases(options: unknown) {
      return mockReleases(options);
    }
  },
}));

const version: any = {
  value: "1.0.0",
  toString: () => "v1.0.0",
  isEqual: vi.fn(),
  detectBump: vi.fn((next: any) =>
    next?.value === "2.0.0"
      ? "major"
      : next?.value === "1.1.0"
        ? "minor"
        : next?.value === "1.0.1"
          ? "patch"
          : undefined,
  ),
  enforceVersionTagRule: vi.fn(),
  checkAfterBump: vi.fn(),
};

const api: any = {
  module: {
    version: vi.fn(() => version),
    bump: vi.fn(async () => undefined),
  },
  config: {
    policies: {
      rules: {
        versionTagMismatch: "error",
      },
    },
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
};

const render = (options?: { sinceRef?: string; all?: boolean }) =>
  new Changelog(api as Api).render(options);

describe("Changelog.render", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    api.module.version = vi.fn(() => version);
    api.module.bump = vi.fn(async () => undefined);
    api.config.policies.rules.versionTagMismatch = "error";
    api.logger.warn = vi.fn();
    version.isEqual = vi.fn();
    version.detectBump = vi.fn((next: any) =>
      next?.value === "2.0.0"
        ? "major"
        : next?.value === "1.1.0"
          ? "minor"
          : next?.value === "1.0.1"
            ? "patch"
            : undefined,
    );
    version.enforceVersionTagRule = vi.fn((opts: any) => {
      try {
        version.isEqual(opts.lastTag());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("No names found")) return;
        if ((opts.rule ?? "error") === "error") {
          throw new Error(
            `Unable to continue release. package.json version must match the last git tag. Root cause: ${message}`,
          );
        }
        if (opts.rule === "warn") {
          opts.warn?.(
            `[relasy] Continuing despite version/tag mismatch because policies.rules.version-tag-mismatch=warn. package.json version must match the last git tag. Root cause: ${message}`,
          );
        }
      }
    });
    version.checkAfterBump = vi.fn();
    mockLastTag.mockReturnValue("v1.0.0");
    mockPreviewRelease.mockResolvedValue({
      tag: version,
      changes: [],
      releaseDate: new Date("2026-04-05T00:00:00Z"),
      previousVersion: undefined,
    });
    mockReleases.mockResolvedValue([
      {
        tag: version,
        changes: [],
        releaseDate: new Date("2026-04-05T00:00:00Z"),
        previousVersion: undefined,
      },
    ]);
    mockFetchReleasePlan.mockResolvedValue({
      release: {
        tag: {
          value: "1.0.1",
          toString: () => "v1.0.1",
          isEqual: vi.fn(),
          detectBump: vi.fn(),
        },
        changes: [],
        releaseDate: new Date("2026-04-05T00:00:00Z"),
        previousVersion: version,
      },
      bump: "patch",
    });
    mockDocuments.mockReturnValue("ok");
    vi.spyOn(Changelog.prototype, "documents").mockImplementation(
      (releases: any) =>
        releases
          .map((release: any) =>
            mockDocuments(release.tag, release.changes, {
              releaseDate: release.releaseDate,
              previousVersion: release.previousVersion,
            }),
          )
          .join("\n\n"),
    );
  });

  test("uses minor bump when feature is present", async () => {
    mockFetchReleasePlan.mockResolvedValue({
      release: {
        tag: {
          value: "1.1.0",
          toString: () => "v1.1.0",
          isEqual: vi.fn(),
          detectBump: vi.fn(),
        },
        changes: [
          {
            number: 1,
            title: "feat",
            body: "",
            author: { login: "u", url: "url" },
            labels: { nodes: [] },
            type: "feature",
            pkgs: [],
          },
        ],
        releaseDate: new Date("2026-04-05T00:00:00Z"),
      },
      bump: "minor",
    });

    const nextVersion: any = {
      value: "1.1.0",
      toString: () => "v1.1.0",
      isEqual: vi.fn(),
      checkAfterBump: vi.fn(),
    };
    api.module.version = vi
      .fn()
      .mockReturnValueOnce(version)
      .mockReturnValueOnce(nextVersion);

    const out = await render();

    expect(version.isEqual).toHaveBeenCalledWith("v1.0.0");
    expect(api.module.bump).toHaveBeenCalledWith("minor");
    expect(out).toBe("ok");
  });

  test("continues when repository has no tags", async () => {
    mockLastTag.mockImplementation(() => {
      throw new Error("fatal: No names found, cannot describe anything.");
    });

    const nextVersion: any = {
      value: "1.0.1",
      toString: () => "v1.0.1",
      isEqual: vi.fn(),
      checkAfterBump: vi.fn(),
    };
    api.module.version = vi
      .fn()
      .mockReturnValueOnce(version)
      .mockReturnValueOnce(nextVersion);

    await expect(render()).resolves.toBe("ok");
    expect(api.module.bump).toHaveBeenCalledWith("patch");
  });

  test("throws clear mismatch error when tag check fails for other reason", async () => {
    mockLastTag.mockImplementation(() => {
      throw new Error("versions does not match: 1.0.0 v1.0.1");
    });

    await expect(render()).rejects.toThrow(
      "Unable to continue release. package.json version must match the last git tag.",
    );
  });

  test("can continue on version/tag mismatch when rule is warn", async () => {
    api.config.policies.rules.versionTagMismatch = "warn";
    mockLastTag.mockImplementation(() => {
      throw new Error("versions does not match: 1.0.0 v1.0.1");
    });

    const nextVersion: any = {
      value: "1.0.1",
      toString: () => "v1.0.1",
      isEqual: vi.fn(),
      checkAfterBump: vi.fn(),
    };
    api.module.version = vi
      .fn()
      .mockReturnValueOnce(version)
      .mockReturnValueOnce(nextVersion);

    await expect(render()).resolves.toBe("ok");
    expect(api.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("policies.rules.version-tag-mismatch=warn"),
    );
  });

  test("throws when applied version does not match planned release version", async () => {
    const nextVersion: any = {
      value: "2.0.0",
      toString: () => "v2.0.0",
      isEqual: vi.fn(() => {
        throw new Error("versions does not match");
      }),
      checkAfterBump: vi.fn(() => {
        throw new Error(
          "Version mismatch after bump: expected v1.1.0, got v2.0.0.",
        );
      }),
    };

    mockFetchReleasePlan.mockResolvedValue({
      release: {
        tag: {
          value: "1.1.0",
          toString: () => "v1.1.0",
          isEqual: vi.fn(),
          detectBump: vi.fn(),
        },
        changes: [
          {
            number: 1,
            title: "feat",
            body: "",
            author: { login: "u", url: "url" },
            labels: { nodes: [] },
            type: "feature",
            pkgs: [],
          },
        ],
        releaseDate: new Date("2026-04-05T00:00:00Z"),
      },
      bump: "minor",
    });

    api.module.version = vi
      .fn()
      .mockReturnValueOnce(version)
      .mockReturnValueOnce(nextVersion);

    await expect(render()).rejects.toThrow(
      "Version mismatch after bump: expected v1.1.0, got v2.0.0.",
    );

    expect(api.module.bump).toHaveBeenCalledWith("minor");
  });

  test("supports preview mode from a custom start ref without bump", async () => {
    await expect(render({ sinceRef: "v1.2.0" })).resolves.toBe("ok");

    expect(mockPreviewRelease).toHaveBeenCalledWith(
      expect.objectContaining({
        currentVersion: version,
        sinceRef: "v1.2.0",
      }),
    );
    expect(api.module.bump).not.toHaveBeenCalled();
  });

  test("supports full history mode from all tags", async () => {
    mockReleases.mockResolvedValue([
      {
        tag: version,
        changes: [],
        releaseDate: new Date("2026-04-05T00:00:00Z"),
        previousVersion: undefined,
      },
      {
        tag: { ...version, value: "1.1.0", toString: () => "v1.1.0" },
        changes: [],
        releaseDate: new Date("2026-04-06T00:00:00Z"),
        previousVersion: version,
      },
    ]);

    await expect(render({ all: true })).resolves.toBe("ok\n\nok");

    expect(mockReleases).toHaveBeenCalledWith(
      expect.objectContaining({ currentVersion: version, all: true }),
    );
  });
});
