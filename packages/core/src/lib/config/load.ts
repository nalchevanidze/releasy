import { access, readFile } from "fs/promises";
import yaml from "js-yaml";
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
  pkgs: Record<string, { name: string; paths?: string[] }>;
};

export type Config = Omit<RawConfig, "pkgs"> & ExtraConfig;

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

const normalizePkgs = (pkgs: RawConfig["pkgs"]) =>
  Object.fromEntries(
    Object.entries(pkgs).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, { name: value }];
      }

      return [key, { name: value.name, paths: value.paths }];
    }),
  );

export const normalizeConfig = (config: RawConfig, gh: string): Config => {
  validateChangelogTemplates(config.changelog);

  return {
    ...config,
    pkgs: normalizePkgs(config.pkgs),
    gh,
    configVersion: config.configVersion ?? 1,
    labelPolicy: config.labelPolicy ?? "strict",
    nonPrCommitsPolicy: config.nonPrCommitsPolicy ?? "skip",
    changeTypes: defaultChangeTypes,
  };
};

const exists = async (path: string) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

export const loadRawConfig = async (): Promise<RawConfig> => {
  const yamlPath = (await exists("./relasy.yaml"))
    ? "./relasy.yaml"
    : await exists("./relasy.yml")
      ? "./relasy.yml"
      : undefined;

  if (yamlPath) {
    const content = await readFile(yamlPath, "utf8");
    return ConfigSchema.parse(yaml.load(content) ?? {});
  }

  if (await exists("./relasy.json")) {
    console.warn(
      "[relasy][deprecation] relasy.json is deprecated. Please migrate to relasy.yaml.",
    );

    const content = await readFile("./relasy.json", "utf8");
    return ConfigSchema.parse(JSON.parse(content));
  }

  throw new Error(
    "Missing configuration file. Expected relasy.yaml (preferred), relasy.yml, or relasy.json.",
  );
};

export const loadConfig = async (): Promise<Config> => {
  const config = await loadRawConfig();
  const gh = remote();

  return normalizeConfig(config, gh);
};
