import { Result, fail, ok } from "./result";

type IRelasyDraft = {
  changelog(): Promise<string>;
  module: { postBump(): Promise<void>; version(): { toString(): string } };
  github: {
    setup(): void;
    release(
      version: { toString(): string },
      body: string,
    ): Promise<{ data: { number: number; html_url: string } }>;
  };
};

export type DraftReleaseOutput = {
  version: string;
  releaseBranch: string;
  prNumber: number;
  prUrl: string;
};

export const draftRelease = async (
  iRelasy: IRelasyDraft,
): Promise<Result<DraftReleaseOutput>> => {
  try {
    const body = await iRelasy.changelog();
    await iRelasy.module.postBump();
    iRelasy.github.setup();

    const version = iRelasy.module.version();
    const releaseBranch = `release-${version.toString()}`;
    const pr = await iRelasy.github.release(version, body);

    return ok({
      version: version.toString(),
      releaseBranch,
      prNumber: pr.data.number,
      prUrl: pr.data.html_url,
    });
  } catch (error) {
    return fail(
      "RELEASE_FAILED",
      error instanceof Error ? error.message : String(error),
    );
  }
};
