import { readFile } from "fs/promises";
import * as z from "zod";
import { remote } from "./git";

export type LabelType = "pkgs" | "changeTypes";

const changeTypes = {
  breaking: "Breaking change (major bump)",
  feature: "New feature (minor bump)",
  fix: "Bug fix (patch bump)",
  chore: "Minor / maintenance change (patch bump)",
};

export type ChangeType = keyof typeof changeTypes;

export const CustomManagerSchema = z.object({
  type: z.literal("custom"),
  bump: z.string(),
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
  pkgs: z.record(z.string(), z.string()),
  project: ManagerSchema,
});

type RawConfig = z.infer<typeof ConfigSchema>;

type ExtraConfig = {
  gh: string;
  changeTypes: Record<ChangeType, string>;
};

export type Config = RawConfig & ExtraConfig;

export const loadConfig = async (): Promise<Config> => {
  const data = await readFile("./relasy.json", "utf8").then(JSON.parse);
  const config = ConfigSchema.parse(data);
  const gh = remote();

  return { ...config, gh, changeTypes };
};
