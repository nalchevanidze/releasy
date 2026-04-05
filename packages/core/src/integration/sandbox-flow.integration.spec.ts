import { describe, expect, test } from "vitest";
import { checkLabels, draftRelease } from "../app";

type SandboxState = {
  labelsBootstrapped: boolean;
  releasePrMerged: boolean;
  releasePublished: boolean;
};

const bootstrapLabels = (state: SandboxState) => {
  state.labelsBootstrapped = true;
};

const validatePrLabels = (labels: string[]) => labels.includes("✨ feature");

const mergeReleasePr = (state: SandboxState) => {
  state.releasePrMerged = true;
};

const publishRelease = (state: SandboxState) => {
  if (!state.releasePrMerged) {
    throw new Error("release PR must be merged before publishing");
  }

  state.releasePublished = true;
};

describe("sandbox flow harness (high-fidelity local e2e)", () => {
  test("runs bootstrap -> validate -> draft -> merge -> publish", async () => {
    const state: SandboxState = {
      labelsBootstrapped: false,
      releasePrMerged: false,
      releasePublished: false,
    };

    bootstrapLabels(state);
    expect(state.labelsBootstrapped).toBe(true);

    const labels = ["✨ feature", "📦 core"];
    expect(validatePrLabels(labels)).toBe(true);

    const iRelasy = {
      changelog: async () => "generated notes",
      module: {
        postBump: async () => undefined,
        version: () => ({ toString: () => "v1.2.3" }),
      },
      github: {
        setup: () => undefined,
        release: async () => ({
          data: {
            number: 42,
            html_url: "https://github.com/acme/demo/pull/42",
          },
        }),
      },
      parseLabels: (_labels: string[]) => ({
        changeTypes: [{ changeType: "feature" }],
        pkgs: [],
      }),
      config: {
        changeTypes: {
          feature: "Features",
          fix: "Fixes",
          chore: "Chores",
          breaking: "Breaking",
        },
      },
    };

    const labelCheck = checkLabels(iRelasy as any, labels, true);
    expect(labelCheck.ok).toBe(true);

    const drafted = await draftRelease(iRelasy as any);
    expect(drafted.ok).toBe(true);

    mergeReleasePr(state);
    publishRelease(state);

    expect(state.releasePrMerged).toBe(true);
    expect(state.releasePublished).toBe(true);
  });

  test("rerun draft refreshes generated release state while reusing same PR", async () => {
    let changelogVersion = 0;
    let releaseBranchCommits = 0;
    let lastBody = "";

    const iRelasy = {
      changelog: async () => {
        changelogVersion += 1;
        return `generated notes ${changelogVersion}`;
      },
      module: {
        postBump: async () => {
          releaseBranchCommits += 1;
        },
        version: () => ({ toString: () => "v1.2.3" }),
      },
      github: {
        setup: () => undefined,
        release: async (_version: { toString(): string }, body: string) => {
          lastBody = body;
          return {
            data: {
              number: 42,
              html_url: "https://github.com/acme/demo/pull/42",
            },
          };
        },
      },
    };

    const first = await draftRelease(iRelasy as any);
    const second = await draftRelease(iRelasy as any);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.data.prNumber).toBe(42);
      expect(second.data.prNumber).toBe(42);
      expect(first.data.prUrl).toBe(second.data.prUrl);
    }

    expect(releaseBranchCommits).toBe(2);
    expect(lastBody).toBe("generated notes 2");
  });
});
