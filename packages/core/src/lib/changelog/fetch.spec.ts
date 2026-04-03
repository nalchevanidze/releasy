import { describe, expect, test } from "vitest";
import { parsePRNumberFromCommitMessage } from "./fetch";

describe("parsePRNumberFromCommitMessage", () => {
  test("parses squash merge format", () => {
    expect(parsePRNumberFromCommitMessage("feat: add X (#123)")).toBe(123);
  });

  test("parses merge commit format", () => {
    expect(
      parsePRNumberFromCommitMessage("Merge pull request #456 from org/branch"),
    ).toBe(456);
  });

  test("parses PR # format", () => {
    expect(parsePRNumberFromCommitMessage("fix: bug PR#789")).toBe(789);
  });

  test("parses plain #number fallback", () => {
    expect(parsePRNumberFromCommitMessage("refactor around #42")).toBe(42);
  });

  test("returns undefined when no PR number exists", () => {
    expect(
      parsePRNumberFromCommitMessage("chore: update docs"),
    ).toBeUndefined();
  });
});
