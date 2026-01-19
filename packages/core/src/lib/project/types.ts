import { Version } from "../version";

export type VersionChangeType = "major" | "minor" | "patch";

export type Module = {
  version(): Version;
  setup(): Promise<void>;
  next(option: VersionChangeType): Promise<void>;
  pkg(id: string): string;
};
