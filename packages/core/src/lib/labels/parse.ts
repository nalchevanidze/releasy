import { ChangeType, Config, LabelType } from "../config";
import { Label } from "./label";

const emojies: Record<string, string> = {
  package: "📦",
  breaking: "💥",
  feature: "✨",
  fix: "🐛",
  chore: "🧹",
  major: "🚨",
};

const parseNameMap: Record<string, LabelType> = {
  scope: "scopes",
  type: "changeTypes",
  "📦": "scopes",
  "💥": "changeTypes",
  "✨": "changeTypes",
  "🐛": "changeTypes",
  "🧹": "changeTypes",
  "🚨": "changeTypes",
  "🏷️": "changeTypes",
};

const printName = (type: LabelType, key: string) => {
  if (type === "changeTypes") {
    return `${emojies[key] ?? "🏷️"} ${key}`;
  }

  return `📦 ${key}`;
};

const colors: Record<string, string> = {
  major: "B60205", // red (GitHub danger)
  breaking: "B60205", // red (same as major)
  feature: "0E8A16", // green
  fix: "1D76DB", // blue
  minor: "D4DADF", // light gray
  chore: "D4DADF", // light gray
  pkg: "FFFFFF", // teal (package scope / grouping)
};

export const parseLabel = <T extends LabelType>(
  config: Config,
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

    if (longName) return createLabel("changeTypes", name, longName, original);

    return undefined;
  }

  const type = parseNameMap[prefix];

  if (!type) return;

  const longNames: Record<string, string> = config[type];

  if (longNames[sub]) {
    return createLabel(type, sub, longNames[sub], original);
  }

  const fields = Object.keys(longNames).join(", ");

  throw new Error(
    `invalid label ${original}. key ${sub} could not be found on object with fields: ${fields}`,
  );
};

export const createLabel = (
  type: LabelType,
  key: string,
  longName: string,
  existing?: string,
): Label =>
  ({
    type,
    scope: key,
    color: colors[key] || colors.pkg, // Use specific color or fallback to pkg
    description:
      type === "changeTypes"
        ? `Label for versioning: ${longName}`
        : `Label for affected scope: "${longName}"`,
    name: printName(type, key),
    existing,
  }) as Label;
