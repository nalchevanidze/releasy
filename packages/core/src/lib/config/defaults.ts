import { ChangeType } from "./schema";

export const defaultChangeTypes: Record<ChangeType, string> = {
  breaking: "Breaking change (major bump)",
  feature: "New feature (minor bump)",
  fix: "Bug fix (patch bump)",
  chore: "Minor / maintenance change (patch bump)",
  docs: "Documentation change (patch bump)",
  test: "Testing change (patch bump)",
};
