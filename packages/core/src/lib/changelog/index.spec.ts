import { describe, expect, test, vi, beforeEach } from "vitest";
import { renderChangelog } from "./index";
import type { Api, Change } from "./types";

const mockLastTag = vi.fn();
const mockListTags = vi.fn();
const mockDateAtRef = vi.fn();
const mockChanges = vi.fn();
const mockChangesSinceRef = vi.fn();
const mockChangesBetweenRefs = vi.fn();
const mockRender = vi.fn();

vi.mock("../git", () => ({
  lastTag: () => mockLastTag(),
  listTags: () => mockListTags(),
  dateAtRef: (ref: string) => mockDateAtRef(ref),
}));

vi.mock("./fetch", () => ({
  FetchApi: class {
    changes(version: unknown) {
      return mockChanges(version);
    }

    changesSinceRef(ref: string) {
      return mockChangesSinceRef(ref);
    }

    changesBetweenRefs(fromExclusive: string | undefined, to: string) {
      return mockChangesBetweenRefs(fromExclusive, to);
    }
  },
}));

vi.mock("./render", () => ({
  RenderAPI: class {
    changes(version: unknown, changes: Change[], previousTag?: string) {
      return mockRender(version, changes, previousTag);
    }
  },
}));

const version: any = {
  value: "1.0.0",
  toString: () => "v1.0.0",
  isEqual: vi.fn(),
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

describe("renderChangelog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.module.version = vi.fn(() => version);
    api.module.bump = vi.fn(async () => undefined);
    api.config.policies.rules.versionTagMismatch = "error";
    api.logger.warn = vi.fn();
    version.isEqual = vi.fn();
    mockChanges.mockResolvedValue([]);
    mockChangesSinceRef.mockResolvedValue([]);
    mockChangesBetweenRefs.mockResolvedValue([]);
    mockListTags.mockReturnValue([]);
    mockDateAtRef.mockReturnValue("2026-04-05");
    mockRender.mockReturnValue("ok");
  });

  test("uses minor bump when feature is present", async () => {
    mockLastTag.mockReturnValue("v1.0.0");
    mockChanges.mockResolvedValue([
      {
        number: 1,
        title: "feat",
        body: "",
        author: { login: "u", url: "url" },
        labels: { nodes: [] },
        type: "feature",
        pkgs: [],
      },
    ]);

    const out = await renderChangelog(api as Api);

    expect(version.isEqual).toHaveBeenCalledWith("v1.0.0");
    expect(api.module.bump).toHaveBeenCalledWith("minor");
    expect(out).toBe("ok");
  });

  test("continues when repository has no tags", async () => {
    mockLastTag.mockImplementation(() => {
      throw new Error("fatal: No names found, cannot describe anything.");
    });

    await expect(renderChangelog(api as Api)).resolves.toBe("ok");
    expect(api.module.bump).toHaveBeenCalledWith("patch");
  });

  test("throws clear mismatch error when tag check fails for other reason", async () => {
    mockLastTag.mockImplementation(() => {
      throw new Error("versions does not match: 1.0.0 v1.0.1");
    });

    await expect(renderChangelog(api as Api)).rejects.toThrow(
      "Unable to continue release. package.json version must match the last git tag.",
    );
  });

  test("can continue on version/tag mismatch when rule is warn", async () => {
    api.config.policies.rules.versionTagMismatch = "warn";
    mockLastTag.mockImplementation(() => {
      throw new Error("versions does not match: 1.0.0 v1.0.1");
    });

    await expect(renderChangelog(api as Api)).resolves.toBe("ok");
    expect(api.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("policies.rules.version-tag-mismatch=warn"),
    );
  });

  test("supports preview mode from a custom start tag without bump", async () => {
    await expect(
      renderChangelog(api as Api, { sinceTag: "v1.2.0" }),
    ).resolves.toBe("ok");

    expect(mockChangesSinceRef).toHaveBeenCalledWith("v1.2.0");
    expect(api.module.bump).not.toHaveBeenCalled();
  });

  test("supports full history mode from all tags", async () => {
    mockListTags.mockReturnValue(["v1.0.0", "v1.1.0"]);

    await expect(renderChangelog(api as Api, { all: true })).resolves.toBe(
      "ok\n\nok",
    );

    expect(mockChangesBetweenRefs).toHaveBeenNthCalledWith(1, undefined, "v1.0.0");
    expect(mockChangesBetweenRefs).toHaveBeenNthCalledWith(2, "v1.0.0", "v1.1.0");
  });
});
