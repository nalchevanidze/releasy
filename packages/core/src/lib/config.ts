export {
  changeTypes,
  ConfigSchema,
  CustomManagerSchema,
  ManagerSchema,
  NPMManagerSchema,
} from "./config/schema";

export type {
  ChangelogConfig,
  ChangeType,
  ConfigVersion,
  CustomManager,
  LabelPolicy,
  LabelType,
  Manager,
  NPMManager,
  NonPrCommitPolicy,
  PackageScope,
  RawConfig,
  RulesConfig,
} from "./config/schema";

export type { Config } from "./config/load";
export {
  loadConfig,
  loadRawConfig,
  normalizeConfig,
  validateChangelogTemplates,
} from "./config/load";
