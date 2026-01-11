export type Module = {
  version(): string;
  setup(): Promise<void>;
  next(isBreaking: boolean): Promise<void>;
};
