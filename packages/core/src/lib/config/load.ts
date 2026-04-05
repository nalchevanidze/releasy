import { access, readFile } from "fs/promises";
import yaml from "js-yaml";
import { remote } from "../git";
import {
  BumpLevel,
  defaultChangeTypeBumps,
  defaultChangeTypeEmojis,
  defaultChangeTypes,
  defaultDetectionUse,
  defaultLabelMode,
  defaultRuleLevels,
} from "./defaults";
import {
  ChangeType,
  ChangelogConfig,
  ConfigSchema,
  RawConfig,
  RuleLevel,
} from "./schema";

type ExtraConfig = {
  gh: string;
  changeTypes: Record<ChangeType, string>;
  changeTypeEmojis?: Record<string, string>;
  changeTypeBumps?: Record<string, BumpLevel>;
  pkgs: Record<string, { name: string; paths?: string[] }>;
  changeTypeScopes?: Record<string, { paths: string[] }>;
  policies: {
    labelMode: "strict" | "permissive";
    autoAddInferredPackages: boolean;
    detectionUse: Array<"labels" | "commits">;
    rules: {
      labelConflict: RuleLevel;
      inferredPackageMissing: RuleLevel;
      detectionConflict: RuleLevel;
      nonPrCommit: RuleLevel;
    };
  };
};

export type Config = Omit<RawConfig, "pkgs" | "policies"> & ExtraConfig;

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

  if (changelog.templates?.header) {
    validateTemplate(
      "changelog.templates.header",
      changelog.templates.header,
      ["VERSION", "DATE"],
      ["VERSION", "DATE"],
    );
  }

  if (changelog.templates?.section) {
    validateTemplate(
      "changelog.templates.section",
      changelog.templates.section,
      ["LABEL", "CHANGES"],
      ["LABEL", "CHANGES"],
    );
  }

  if (changelog.templates?.item) {
    validateTemplate(
      "changelog.templates.item",
      changelog.templates.item,
      ["REF", "TITLE"],
      ["REF", "TITLE", "AUTHOR", "PACKAGES", "BODY", "DETAILS", "STATS"],
    );
  }
};

const toPathList = (paths?: string | string[]) => {
  if (!paths) return undefined;
  return Array.isArray(paths) ? paths : [paths];
};

const normalizePkgs = (pkgs: RawConfig["pkgs"]) =>
  Object.fromEntries(
    Object.entries(pkgs).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, { name: value }];
      }

      return [key, { name: value.name, paths: toPathList(value.paths) }];
    }),
  );

const normalizeChanges = (changes?: RawConfig["changes"]) => {
  const titles: Record<string, string> = { ...defaultChangeTypes };
  const icons: Record<string, string> = { ...defaultChangeTypeEmojis };
  const bumps: Record<string, BumpLevel> = { ...defaultChangeTypeBumps };
  const scopes: Record<string, { paths: string[] }> = {};

  if (!changes) return { titles, icons, bumps, scopes };

  for (const [key, value] of Object.entries(changes)) {
    titles[key] = value.title;
    icons[key] = value.icon;
    bumps[key] = value.bump;

    if (value.paths) {
      scopes[key] = { paths: toPathList(value.paths)! };
    }
  }

  return { titles, icons, bumps, scopes };
};

const toCamel = (key: string) =>
  key.replace(/-([a-zA-Z0-9])/g, (_, char: string) => char.toUpperCase());

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeKeysDeep = (value: unknown, path = "root"): unknown => {
  if (Array.isArray(value)) {
    return value.map((item, index) => normalizeKeysDeep(item, `${path}[${index}]`));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const out: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = toCamel(key);

    if (normalizedKey in out) {
      throw new Error(
        `Duplicate semantic key detected at ${path}: "${key}" conflicts with another key normalized to "${normalizedKey}".`,
      );
    }

    out[normalizedKey] = normalizeKeysDeep(child, `${path}.${key}`);
  }

  return out;
};

const hasLegacyFields = (cfg: Record<string, unknown>) => {
  const topLegacy = [
    "configVersion",
    "labelPolicy",
    "nonPrCommitsPolicy",
    "rules",
  ].some((key) => key in cfg);

  const changelogLegacy = isPlainObject(cfg.changelog)
    ? ["headerTemplate", "sectionTemplate", "itemTemplate", "groupByPackage"].some(
        (key) => key in cfg.changelog,
      )
    : false;

  return topLegacy || changelogLegacy;
};

const hasNewFields = (cfg: Record<string, unknown>) => {
  const topNew = ["policies", "changes", "changelog"].some((key) => key in cfg);

  const changelogNew =
    isPlainObject(cfg.changelog) && ("templates" in cfg.changelog || "grouping" in cfg.changelog);

  return topNew || changelogNew;
};

const parseConfigInput = (input: unknown): RawConfig => {
  const normalized = normalizeKeysDeep(input);
  if (!isPlainObject(normalized)) {
    throw new Error("Configuration root must be an object.");
  }

  if (hasLegacyFields(normalized) && hasNewFields(normalized)) {
    throw new Error(
      "Mixed legacy and new schema keys detected. Use only canonical beta schema keys.",
    );
  }

  return ConfigSchema.parse(normalized);
};

export const normalizeConfig = (config: RawConfig, gh: string): Config => {
  validateChangelogTemplates(config.changelog);

  const normalizedPkgs = normalizePkgs(config.pkgs);
  const normalizedChanges = normalizeChanges(config.changes);

  return {
    ...config,
    pkgs: normalizedPkgs,
    gh,
    policies: {
      labelMode: config.policies?.labelMode ?? defaultLabelMode,
      autoAddInferredPackages: config.policies?.autoAddInferredPackages ?? false,
      detectionUse: config.policies?.detectionUse ?? defaultDetectionUse,
      rules: {
        labelConflict:
          config.policies?.rules?.labelConflict ?? defaultRuleLevels.labelConflict,
        inferredPackageMissing:
          config.policies?.rules?.inferredPackageMissing ??
          defaultRuleLevels.inferredPackageMissing,
        detectionConflict:
          config.policies?.rules?.detectionConflict ??
          defaultRuleLevels.detectionConflict,
        nonPrCommit:
          config.policies?.rules?.nonPrCommit ?? defaultRuleLevels.nonPrCommit,
      },
    },
    changeTypes: normalizedChanges.titles as Record<ChangeType, string>,
    changeTypeEmojis: normalizedChanges.icons,
    changeTypeBumps: normalizedChanges.bumps,
    changeTypeScopes:
      Object.keys(normalizedChanges.scopes).length > 0
        ? normalizedChanges.scopes
        : undefined,
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
    return parseConfigInput(yaml.load(content) ?? {});
  }

  if (await exists("./relasy.json")) {
    console.warn(
      "[relasy][deprecation] relasy.json is deprecated. Please migrate to relasy.yaml.",
    );

    const content = await readFile("./relasy.json", "utf8");
    return parseConfigInput(JSON.parse(content));
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

export const normalizeConfigInputKeys = (input: unknown) => normalizeKeysDeep(input);
