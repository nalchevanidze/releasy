export type VersionBump = "major" | "minor" | "patch";

export class Version {
  private constructor(public value: string) {}

  public detectBump(nextVersion: Version): VersionBump | undefined {
    const parse = (v: Version) =>
      v.value
        .split(".")
        .slice(0, 3)
        .map((part) => Number.parseInt(part, 10));

    const [prevMajor, prevMinor, prevPatch] = parse(this);
    const [nextMajor, nextMinor, nextPatch] = parse(nextVersion);

    if (
      [prevMajor, prevMinor, prevPatch, nextMajor, nextMinor, nextPatch].some(
        (part) => Number.isNaN(part),
      )
    ) {
      return undefined;
    }

    if (nextMajor > prevMajor) return "major";
    if (nextMinor > prevMinor) return "minor";
    if (nextPatch > prevPatch) return "patch";

    return undefined;
  }

  static parse(input: string) {
    return new Version(input.replace(/^v/, ""));
  }

  public toString() {
    return `v${this.value}`;
  }

  public isEqual(v: string) {
    if (this.value !== v.replace(/^v/, "")) {
      throw Error(`versions does not match: ${this.value} ${v}`);
    }
  }

  public ensureEqual(expected: Version) {
    this.isEqual(expected.toString());
  }

  public enforceVersionTagRule(options: {
    lastTag: () => string;
    rule?: "error" | "warn" | "skip";
    warn?: (message: string) => void;
  }) {
    try {
      this.isEqual(options.lastTag());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes("No names found")) {
        return;
      }

      const rule = options.rule ?? "error";
      const mismatchMessage = `package.json version must match the last git tag. Root cause: ${message}`;

      if (rule === "error") {
        throw new Error(`Unable to continue release. ${mismatchMessage}`);
      }

      if (rule === "warn") {
        options.warn?.(
          `[relasy] Continuing despite version/tag mismatch because policies.rules.version-tag-mismatch=warn. ${mismatchMessage}`,
        );
      }
    }
  }

  public checkAfterBump(expected: Version) {
    try {
      this.ensureEqual(expected);
    } catch {
      throw new Error(
        `Version mismatch after bump: expected ${expected.toString()}, got ${this.toString()}.`,
      );
    }
  }
}
