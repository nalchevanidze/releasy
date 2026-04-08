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
  ChangelogConfigSchema,
  ConfigSchema,
  RawConfig,
  RulesConfig,
} from "./schema";

type ExtraConfig = {
  gh: string;
  changeTypes: Record<ChangeType, string>;
  changeTypeEmojis?: Record<string, string>;
  changeTypeBumps?: Record<string, BumpLevel>;
  pkgs: Record<string, { name: string; paths?: string[] }>;
  changeTypeScopes?: Record<string, { paths: string[] }>;
  changelog: {
    noChangesMessage: string;
    untitledChangeMessage: string;
  };
  policies: {
    labelMode: "strict" | "permissive";
    autoAddInferredPackages: boolean;
    detectionUse: Array<"labels" | "commits">;
    rules: RulesConfig;
  };
};

export type Config = Omit<RawConfig, "pkgs" | "policies"> & ExtraConfig;

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

const normalizeRules = (
  rules?: NonNullable<RawConfig["policies"]>["rules"],
): RulesConfig => ({
  ...defaultRuleLevels,
  ...(rules ?? {}),
});

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
    return value.map((item, index) =>
      normalizeKeysDeep(item, `${path}[${index}]`),
    );
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

  const changelog = cfg.changelog;
  const changelogLegacy = isPlainObject(changelog)
    ? [
        "headerTemplate",
        "sectionTemplate",
        "itemTemplate",
        "groupByPackage",
      ].some((key) => key in changelog)
    : false;

  return topLegacy || changelogLegacy;
};

const hasNewFields = (cfg: Record<string, unknown>) =>
  ["policies", "changes", "changelog"].some((key) => key in cfg);

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
  const normalizedPkgs = normalizePkgs(config.pkgs);
  const normalizedChanges = normalizeChanges(config.changes);
  const normalizedChangelog = ChangelogConfigSchema.parse(config.changelog);

  return {
    ...config,
    pkgs: normalizedPkgs,
    gh,
    changelog: normalizedChangelog,
    policies: {
      labelMode: config.policies?.labelMode ?? defaultLabelMode,
      autoAddInferredPackages:
        config.policies?.autoAddInferredPackages ?? false,
      detectionUse: config.policies?.detectionUse ?? defaultDetectionUse,
      rules: normalizeRules(config.policies?.rules),
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

type LoadRawConfigDeps = {
  exists?: (path: string) => Promise<boolean>;
  readTextFile?: (path: string) => Promise<string>;
};

export const resolveRawConfigPath = async (
  existsFn: (path: string) => Promise<boolean> = exists,
): Promise<string | undefined> => {
  if (await existsFn("./relasy.yaml")) return "./relasy.yaml";
  if (await existsFn("./relasy.yml")) return "./relasy.yml";
  return undefined;
};

export const loadRawConfig = async (
  deps: LoadRawConfigDeps = {},
): Promise<RawConfig> => {
  const existsFn = deps.exists ?? exists;
  const readTextFile =
    deps.readTextFile ?? ((path: string) => readFile(path, "utf8"));

  const yamlPath = await resolveRawConfigPath(existsFn);

  if (yamlPath) {
    const content = await readTextFile(yamlPath);
    return parseConfigInput(yaml.load(content) ?? {});
  }

  throw new Error(
    "Missing configuration file. Expected relasy.yaml or relasy.yml.",
  );
};

export const loadConfig = async (): Promise<Config> => {
  const config = await loadRawConfig();
  const gh = remote();

  return normalizeConfig(config, gh);
};

export const normalizeConfigInputKeys = (input: unknown) =>
  normalizeKeysDeep(input);
