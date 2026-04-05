import { ChangeType, LabelType } from "../config";
import { Label } from "./label";

type ParseConfig = {
  changeTypes: Record<string, string>;
  changeTypeEmojis?: Record<string, string>;
  pkgs: Record<string, string | { name: string }>;
};

const emojies: Record<string, string> = {
  package: "📦",
  breaking: "💥",
  feature: "✨",
  fix: "🐛",
  chore: "🧹",
  docs: "📚",
  test: "✅",
  major: "🚨",
};

const parseNameMap: Record<string, LabelType> = {
  pkg: "pkgs",
  scope: "pkgs",
  type: "changeTypes",
  "📦": "pkgs",
  "💥": "changeTypes",
  "✨": "changeTypes",
  "🐛": "changeTypes",
  "🧹": "changeTypes",
  "📚": "changeTypes",
  "✅": "changeTypes",
  "🚨": "changeTypes",
  "🏷️": "changeTypes",
};

const printName = (
  type: LabelType,
  key: string,
  changeTypeEmojis?: Record<string, string>,
) => {
  if (type === "changeTypes") {
    return `${changeTypeEmojis?.[key] ?? emojies[key] ?? "🏷️"} ${key}`;
  }

  return `📦 ${key}`;
};

const colors: Record<string, string> = {
  breaking: "B60205", // orange
  feature: "0E8A16", // green
  docs: "1D76DB", // blue
  test: "5319E7", // purple
  pkg: "FFFFFF",
};

export const parseLabel = (
  config: ParseConfig,
  original: string,
): Label | undefined => {
  const [prefix, sub, ...rest] = original
    .trim()
    .replaceAll(":", "/")
    .replaceAll(" ", "/")
    .split("/");

  if (rest.length && parseNameMap[prefix]) {
    throw new Error(
      `invalid Label "${original}". only one '/' is allowed in labels for ${sub}`,
    );
  }

  if (sub === undefined) {
    const name = prefix as ChangeType;
    const longName = config.changeTypes[name];

    if (longName)
      return createLabel(
        "changeTypes",
        name,
        longName,
        original,
        config.changeTypeEmojis,
      );

    return undefined;
  }

  const dynamicTypePrefix = Object.values(config.changeTypeEmojis ?? {}).includes(
    prefix,
  )
    ? "changeTypes"
    : undefined;

  const type = parseNameMap[prefix] ?? dynamicTypePrefix;

  if (!type) return;

  const longNames: Record<string, string> =
    type === "pkgs"
      ? Object.fromEntries(
          Object.entries(config.pkgs).map(([k, v]) => [k, typeof v === "string" ? v : v.name]),
        )
      : config[type];

  if (longNames[sub]) {
    return createLabel(type, sub, longNames[sub], original, config.changeTypeEmojis);
  }

  const fields = Object.keys(longNames).join(", ");

  throw new Error(
    `invalid label ${original}. key ${sub} could not be found on object with fields: ${fields}`,
  );
};

export const createLabel = <T extends LabelType>(
  type: T,
  key: string,
  longName: string,
  existing?: string,
  changeTypeEmojis?: Record<string, string>,
): Label => {
  switch (type) {
    case "changeTypes":
      return {
        type: "changeTypes",
        changeType: key as ChangeType,
        color: colors[key] || colors.pkg,
        description: `Label for versioning: ${longName}`,
        name: printName(type, key, changeTypeEmojis),
        existing,
      };

    case "pkgs":
      return {
        type: "pkgs",
        pkg: key,
        color: colors.pkg,
        description: `Label for affected Package: "${longName}"`,
        name: printName(type, key),
        existing,
      };
    default:
      throw new Error(`unsupported label type: ${type}`);
  }
};
