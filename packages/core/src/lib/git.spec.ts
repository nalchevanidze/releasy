import { beforeEach, describe, expect, test, vi } from "vitest";

let execFileMock = vi.fn();

vi.mock("./utils", () => ({
  execFile: (...args: unknown[]) => execFileMock(...args),
}));

describe("git helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    execFileMock = vi.fn();
  });

  test("returns empty commit list when range has no commits", async () => {
    const [{ commitsAfterVersion }, { Version }] = await Promise.all([
      import("./git"),
      import("./version"),
    ]);

    execFileMock.mockReturnValueOnce("");

    const commits = commitsAfterVersion(Version.parse("1.0.0"));

    expect(commits).toEqual([]);
  });

  test("falls back to all commits when tag-based lookup fails", async () => {
    const [{ commitsAfterVersion }, { Version }] = await Promise.all([
      import("./git"),
      import("./version"),
    ]);

    execFileMock
      .mockImplementationOnce(() => {
        throw new Error("bad tag");
      })
      .mockImplementationOnce(() => {
        throw new Error("bad raw tag");
      })
      .mockReturnValueOnce("abc\ndef");

    const commits = commitsAfterVersion(Version.parse("1.0.0"));

    expect(commits).toEqual(["abc", "def"]);
  });
});
