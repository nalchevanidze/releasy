export type VersionChangeType = "major" | "minor" | "patch";

export type Module = {
  version(): string;
  setup(): Promise<void>;
  next(option: VersionChangeType): Promise<void>;
  pkg(id: string): string;
};
