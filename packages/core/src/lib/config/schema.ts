import * as z from "zod";

export type LabelType = "pkgs" | "changeTypes";
export type LabelPolicy = "strict" | "permissive";

export type ChangelogConfig = {
  headerTemplate?: string;
  sectionTemplate?: string;
  itemTemplate?: string;
  sectionTitles?: Partial<Record<ChangeType, string>>;
  groupByPackage?: boolean;
};

export type ConfigVersion = 1;

export type NonPrCommitPolicy = "include" | "skip" | "strict-fail";

export type PackageScope = {
  pkg?: string;
  paths: string[];
};

export type RulesConfig = {
  requireInferredPackageLabels?: boolean;
  blockOnLabelConflict?: boolean;
};

export const ChangelogConfigSchema = z
  .object({
    headerTemplate: z.string().optional(),
    sectionTemplate: z.string().optional(),
    itemTemplate: z.string().optional(),
    sectionTitles: z
      .object({
        breaking: z.string().optional(),
        feature: z.string().optional(),
        fix: z.string().optional(),
        chore: z.string().optional(),
      })
      .optional(),
    groupByPackage: z.boolean().optional(),
  })
  .optional();

export const changeTypes = {
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

export const PackageScopeSchema = z.object({
  pkg: z.string().optional(),
  paths: z.array(z.string()).min(1),
});

export const RulesConfigSchema = z
  .object({
    requireInferredPackageLabels: z.boolean().optional(),
    blockOnLabelConflict: z.boolean().optional(),
  })
  .optional();

export const ConfigSchema = z.object({
  configVersion: z.literal(1).optional(),
  pkgs: z.record(z.string(), z.string()),
  project: ManagerSchema,
  labelPolicy: z.enum(["strict", "permissive"]).optional(),
  nonPrCommitsPolicy: z.enum(["include", "skip", "strict-fail"]).optional(),
  packageScopes: z.record(z.string(), PackageScopeSchema).optional(),
  rules: RulesConfigSchema,
  changelog: ChangelogConfigSchema,
});

export type RawConfig = z.infer<typeof ConfigSchema>;
