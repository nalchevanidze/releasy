export {
  changeTypes,
  ConfigSchema,
  CustomManagerSchema,
  ManagerSchema,
  NPMManagerSchema,
} from "./config/schema";

export type {
  BumpLevel,
  ChangelogConfig,
  ChangeType,
  ChangesConfig,
  CustomManager,
  DetectionInput,
  LabelMode,
  LabelType,
  Manager,
  NPMManager,
  PkgConfig,
  PoliciesConfig,
  RawConfig,
  RuleLevel,
  RulesConfig,
} from "./config/schema";

export type { Config } from "./config/load";
export {
  loadConfig,
  loadRawConfig,
  normalizeConfig,
  normalizeConfigInputKeys,
} from "./config/load";
