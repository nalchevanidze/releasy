import {
  ChangeType,
  DetectionInput,
  LabelMode,
  RulesConfig,
} from "./schema";

export type BumpLevel = "major" | "minor" | "patch";

export const defaultChangeTypes: Record<ChangeType, string> = {
  breaking: "Breaking change (major bump)",
  feature: "New feature (minor bump)",
  fix: "Bug fix (patch bump)",
  chore: "Minor / maintenance change (patch bump)",
  docs: "Documentation change (patch bump)",
  test: "Testing change (patch bump)",
};

export const defaultChangeTypeEmojis: Record<ChangeType, string> = {
  breaking: "💥",
  feature: "✨",
  fix: "🐛",
  chore: "🧹",
  docs: "📚",
  test: "✅",
};

export const defaultChangeTypeBumps: Record<ChangeType, BumpLevel> = {
  breaking: "major",
  feature: "minor",
  fix: "patch",
  chore: "patch",
  docs: "patch",
  test: "patch",
};

export const defaultLabelMode: LabelMode = "strict";
export const defaultDetectionUse: DetectionInput[] = ["labels"];
export const defaultRuleLevels: Required<RulesConfig> = {
  labelConflict: "error",
  inferredPackageMissing: "error",
  detectionConflict: "error",
  nonPrCommit: "skip",
  versionTagMismatch: "error",
};
