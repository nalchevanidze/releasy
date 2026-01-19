import { Version } from "../version";

export type BumpType = "major" | "minor" | "patch";

export type Module = {
  version(): Version;
  postBump(): Promise<void>;
  bump(bump: BumpType): Promise<void>;
  pkg(id: string): string;
};
