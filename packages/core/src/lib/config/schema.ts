import * as z from "zod";

export type LabelType = "pkgs" | "changeTypes";
export type LabelPolicy = "strict" | "permissive";

export type ChangelogConfig = {
  headerTemplate?: string;
  sectionTemplate?: string;
  itemTemplate?: string;
  sectionTitles?: Record<string, string>;
  groupByPackage?: boolean;
};

export type ConfigVersion = 1;

export type NonPrCommitPolicy = "include" | "skip" | "strict-fail";
export type BumpLevel = "major" | "minor" | "patch";

export type PkgConfig = {
  name: string;
  paths?: string[];
};

export type ChangeTypeScope = {
  paths: string[];
};

export type RulesConfig = {
  requireInferredPackageLabels?: boolean;
  blockOnLabelConflict?: boolean;
};

export type ChangeDefinition = {
  title?: string;
  icon?: string;
  bump?: BumpLevel;
  paths?: string[];
};

export type ChangesConfig = Record<string, ChangeDefinition>;

export const ChangelogConfigSchema = z
  .object({
    headerTemplate: z.string().optional(),
    sectionTemplate: z.string().optional(),
    itemTemplate: z.string().optional(),
    sectionTitles: z.record(z.string(), z.string()).optional(),
    groupByPackage: z.boolean().optional(),
  })
  .optional();

export const changeTypes = {
  breaking: "Breaking change (major bump)",
  feature: "New feature (minor bump)",
  fix: "Bug fix (patch bump)",
  chore: "Minor / maintenance change (patch bump)",
  docs: "Documentation change (patch bump)",
  test: "Testing change (patch bump)",
};

export type ChangeType = keyof typeof changeTypes;

export const CustomManagerSchema = z.object({
  type: z.literal("custom"),
  bump: z.string(),
  version: z.string(),
  // Optional fields
  pkg: z.string().optional(),
  postBump: z.string().optional(),
  baseBranch: z.string().optional(),
});

export const NPMManagerSchema = z.object({
  type: z.literal("npm"),
  build: z.string().optional(),
  postBump: z.string().optional(),
  baseBranch: z.string().optional(),
});

export type CustomManager = z.infer<typeof CustomManagerSchema>;
export type NPMManager = z.infer<typeof NPMManagerSchema>;

export const ManagerSchema = z.union([NPMManagerSchema, CustomManagerSchema]);
export type Manager = z.infer<typeof ManagerSchema>;

export const PkgConfigSchema = z.union([
  z.string(),
  z.object({
    name: z.string(),
    paths: z.union([z.string(), z.array(z.string()).min(1)]).optional(),
  }),
]);

export const ChangeDefinitionSchema = z.object({
  title: z.string().optional(),
  icon: z.string().optional(),
  bump: z.enum(["major", "minor", "patch"]).optional(),
  paths: z.union([z.string(), z.array(z.string()).min(1)]).optional(),
});

export const RulesConfigSchema = z
  .object({
    requireInferredPackageLabels: z.boolean().optional(),
    blockOnLabelConflict: z.boolean().optional(),
  })
  .optional();

export const ConfigSchema = z.object({
  configVersion: z.literal(1).optional(),
  pkgs: z.record(z.string(), PkgConfigSchema),
  project: ManagerSchema,
  labelPolicy: z.enum(["strict", "permissive"]).optional(),
  nonPrCommitsPolicy: z.enum(["include", "skip", "strict-fail"]).optional(),
  changes: z.record(z.string(), ChangeDefinitionSchema).optional(),
  rules: RulesConfigSchema,
  changelog: ChangelogConfigSchema,
});

export type RawConfig = z.infer<typeof ConfigSchema>;
