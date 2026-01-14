import { readFile } from "fs/promises";
import * as z from "zod";
import { remote } from "./git";

export type LabelType = "scopes" | "changeTypes";

export const ChangeTypeSchema = z.enum([
  "major",
  "breaking",
  "feature",
  "fix",
  "chore",
]);

export type ChangeType = z.infer<typeof ChangeTypeSchema>;

export const CustomManagerSchema = z.object({
  type: z.literal("custom"),
  next: z.string(),
  version: z.string(),
  setup: z.string(),
  pkg: z.string(),
});

export const NPMManagerSchema = z.object({
  type: z.literal("npm"),
});

export type CustomManager = z.infer<typeof CustomManagerSchema>;

export type NPMManager = z.infer<typeof NPMManagerSchema>;

export const ManagerSchema = z.union([NPMManagerSchema, CustomManagerSchema]);

export type Manager = z.infer<typeof ManagerSchema>;

export const ConfigSchema = z.object({
  scopes: z.record(z.string(), z.string()),
  changeTypes: z.record(ChangeTypeSchema, z.string()).optional(),
  project: ManagerSchema,
});

type RawConfig = z.infer<typeof ConfigSchema>;

export type Config = Omit<RawConfig, "changeTypes"> & {
  changeTypes: Record<ChangeType, string>;
  gh: string;
};

export const loadConfig = async (): Promise<Config> => {
  const data = await readFile("./relasy.json", "utf8").then(JSON.parse);
  const config = ConfigSchema.parse(data);
  const gh = remote();

  return {
    ...config,
    gh,
    changeTypes: {
      major: "Major Change",
      breaking: "Breaking Change",
      feature: "New features",
      fix: "Bug Fixes",
      chore: "Minor Changes",
      ...config.changeTypes,
    },
  };
};
