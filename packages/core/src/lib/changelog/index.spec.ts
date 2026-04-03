import { describe, expect, test, vi, beforeEach } from "vitest";
import { renderChangelog } from "./index";
import type { Api, Change } from "./types";

const mockLastTag = vi.fn();
const mockChanges = vi.fn();
const mockRender = vi.fn();

vi.mock("../git", () => ({
  lastTag: () => mockLastTag(),
}));

vi.mock("./fetch", () => ({
  FetchApi: class {
    changes(version: unknown) {
      return mockChanges(version);
    }
  },
}));

vi.mock("./render", () => ({
  RenderAPI: class {
    changes(version: unknown, changes: Change[]) {
      return mockRender(version, changes);
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
};

describe("renderChangelog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.module.version = vi.fn(() => version);
    api.module.bump = vi.fn(async () => undefined);
    version.isEqual = vi.fn();
    mockChanges.mockResolvedValue([]);
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
});
