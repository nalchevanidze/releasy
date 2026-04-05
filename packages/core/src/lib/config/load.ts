import { readFile } from "fs/promises";
import { remote } from "../git";
import { defaultChangeTypes } from "./defaults";
import {
  ChangeType,
  ChangelogConfig,
  ConfigSchema,
  RawConfig,
} from "./schema";

type ExtraConfig = {
  gh: string;
  configVersion?: 1;
  changeTypes: Record<ChangeType, string>;
  labelPolicy?: "strict" | "permissive";
  nonPrCommitsPolicy?: "include" | "skip" | "strict-fail";
};

export type Config = RawConfig & ExtraConfig;

const readPlaceholders = (template: string): string[] => {
  const out: string[] = [];
  const re = /{{([A-Z_]+)}}/g;
  let match: RegExpExecArray | null = null;

  while ((match = re.exec(template))) {
    out.push(match[1]);
  }

  return out;
};

const validateTemplate = (
  label: string,
  template: string,
  required: string[],
  allowed: string[],
) => {
  const placeholders = readPlaceholders(template);

  const missing = required.filter((x) => !placeholders.includes(x));
  if (missing.length > 0) {
    throw new Error(
      `${label} is missing required placeholders: ${missing.join(", ")}`,
    );
  }

  const unknown = placeholders.filter((x) => !allowed.includes(x));
  if (unknown.length > 0) {
    throw new Error(
      `${label} contains unknown placeholders: ${unknown.join(", ")}`,
    );
  }
};

export const validateChangelogTemplates = (changelog?: ChangelogConfig) => {
  if (!changelog) return;

  if (changelog.headerTemplate) {
    validateTemplate(
      "changelog.headerTemplate",
      changelog.headerTemplate,
      ["VERSION", "DATE"],
      ["VERSION", "DATE"],
    );
  }

  if (changelog.sectionTemplate) {
    validateTemplate(
      "changelog.sectionTemplate",
      changelog.sectionTemplate,
      ["LABEL", "CHANGES"],
      ["LABEL", "CHANGES"],
    );
  }

  if (changelog.itemTemplate) {
    validateTemplate(
      "changelog.itemTemplate",
      changelog.itemTemplate,
      ["REF", "TITLE"],
      ["REF", "TITLE", "AUTHOR", "PACKAGES", "BODY", "DETAILS", "STATS"],
    );
  }
};

export const normalizeConfig = (config: RawConfig, gh: string): Config => {
  validateChangelogTemplates(config.changelog);

  return {
    ...config,
    gh,
    configVersion: config.configVersion ?? 1,
    labelPolicy: config.labelPolicy ?? "strict",
    nonPrCommitsPolicy: config.nonPrCommitsPolicy ?? "skip",
    changeTypes: defaultChangeTypes,
  };
};

export const loadConfig = async (): Promise<Config> => {
  const data = await readFile("./relasy.json", "utf8").then(JSON.parse);
  const config = ConfigSchema.parse(data);
  const gh = remote();

  return normalizeConfig(config, gh);
};
