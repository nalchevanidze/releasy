import * as z from "zod";

export const ruleLevelValues = ["skip", "warn", "error"] as const;
export const RuleLevelSchema = z.enum(ruleLevelValues);

export type LabelType = "pkgs" | "changeTypes";
export type LabelMode = "strict" | "permissive";
export type RuleLevel = z.infer<typeof RuleLevelSchema>;
export type DetectionInput = "labels" | "commits";
export type BumpLevel = "major" | "minor" | "patch";

export type ChangelogConfig = {
  noChangesMessage: string;
  untitledChangeMessage: string;
};

export type PkgConfig = {
  name: string;
  paths?: string[];
};

export type RulesConfig = {
  labelConflict?: RuleLevel;
  inferredPackageMissing?: RuleLevel;
  detectionConflict?: RuleLevel;
  nonPrCommit?: RuleLevel;
  versionTagMismatch?: RuleLevel;
};

export type PoliciesConfig = {
  labelMode?: LabelMode;
  autoAddInferredPackages?: boolean;
  detectionUse?: DetectionInput[];
  rules?: RulesConfig;
};

export type ChangeDefinition = {
  title: string;
  icon: string;
  bump: BumpLevel;
  paths?: string[];
};

export type ChangesConfig = Record<string, ChangeDefinition>;

export const ChangelogConfigSchema = z
  .object({
    noChangesMessage: z
      .string()
      .default("No user-facing changes since the last tag."),
    untitledChangeMessage: z.string().default("Untitled change"),
  })
  .strict()
  .default({});

export const changeTypes = {
  breaking: "Breaking change (major bump)",
  feature: "New feature (minor bump)",
  fix: "Bug fix (patch bump)",
  chore: "Minor / maintenance change (patch bump)",
  docs: "Documentation change (patch bump)",
  test: "Testing change (patch bump)",
};

export type ChangeType = keyof typeof changeTypes;

export const CustomManagerSchema = z
  .object({
    type: z.literal("custom"),
    bump: z.string(),
    version: z.string(),
    pkg: z.string().optional(),
    postBump: z.string().optional(),
    baseBranch: z.string().optional(),
  })
  .strict();

export const NPMManagerSchema = z
  .object({
    type: z.literal("npm"),
    build: z.string().optional(),
    postBump: z.string().optional(),
    baseBranch: z.string().optional(),
  })
  .strict();

export type CustomManager = z.infer<typeof CustomManagerSchema>;
export type NPMManager = z.infer<typeof NPMManagerSchema>;

export const ManagerSchema = z.union([NPMManagerSchema, CustomManagerSchema]);
export type Manager = z.infer<typeof ManagerSchema>;

export const PkgConfigSchema = z.union([
  z.string(),
  z
    .object({
      name: z.string(),
      paths: z.union([z.string(), z.array(z.string()).min(1)]).optional(),
    })
    .strict(),
]);

export const ChangeDefinitionSchema = z
  .object({
    title: z.string(),
    icon: z.string(),
    bump: z.enum(["major", "minor", "patch"]),
    paths: z.union([z.string(), z.array(z.string()).min(1)]).optional(),
  })
  .strict();

export const RulesConfigSchema = z
  .object({
    labelConflict: RuleLevelSchema.optional(),
    inferredPackageMissing: RuleLevelSchema.optional(),
    detectionConflict: RuleLevelSchema.optional(),
    nonPrCommit: RuleLevelSchema.optional(),
    versionTagMismatch: RuleLevelSchema.optional(),
  })
  .optional();

export const PoliciesConfigSchema = z
  .object({
    labelMode: z.enum(["strict", "permissive"]).optional(),
    autoAddInferredPackages: z.boolean().optional(),
    detectionUse: z
      .array(z.enum(["labels", "commits"]))
      .min(1)
      .optional(),
    rules: RulesConfigSchema,
  })
  .optional();

export const ConfigSchema = z
  .object({
    pkgs: z.record(z.string(), PkgConfigSchema),
    project: ManagerSchema,
    policies: PoliciesConfigSchema,
    changes: z.record(z.string(), ChangeDefinitionSchema).optional(),
    changelog: ChangelogConfigSchema,
  })
  .strict();

export type RawConfig = z.input<typeof ConfigSchema>;
