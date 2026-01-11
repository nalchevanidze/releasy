import { readFile } from "fs/promises";
import * as z from "zod";

export type LabelType = "pr" | "scope";

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
});

export type CustomManager = z.infer<typeof CustomManagerSchema>;

export const ManagerSchema = z.union([z.literal("npm"), CustomManagerSchema]);

export type Manager = z.infer<typeof ManagerSchema>;

export const ConfigSchema = z.object({
  gh: z.string(),
  scope: z.record(z.string(), z.string()),
  pr: z.record(ChangeTypeSchema, z.string()).optional(),
  pkg: z.string(),
  user: z
    .object({
      name: z.string(),
      email: z.string().email(),
    })
    .optional(),
  manager: ManagerSchema,
});

type RawConfig = z.infer<typeof ConfigSchema>;

export type Config = Omit<RawConfig, "pr"> & { pr: Record<ChangeType, string> };

export const loadConfig = async (): Promise<Config> => {
  const data = await readFile("./relasy.json", "utf8").then(JSON.parse);
  const config = ConfigSchema.parse(data);

  return {
    ...config,
    pr: {
      major: "Major Change",
      breaking: "Breaking Change",
      feature: "New features",
      fix: "Bug Fixes",
      chore: "Minor Changes",
      ...config.pr,
    },
  };
};
