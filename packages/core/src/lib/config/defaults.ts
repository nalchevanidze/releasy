import { ChangeType } from "./schema";

export const defaultChangeTypes: Record<ChangeType, string> = {
  breaking: "Breaking change (major bump)",
  feature: "New feature (minor bump)",
  fix: "Bug fix (patch bump)",
  chore: "Minor / maintenance change (patch bump)",
};
