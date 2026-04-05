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
  RawConfig,
} from "./config/schema";

export type { Config } from "./config/load";
export { loadConfig } from "./config/load";
