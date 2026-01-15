import { ChangeType, Config, LabelType } from "./config";

export type Label = {
  type: LabelType;
  key: string;
  name: string;
  color: string; // hex without #
  description?: string;
  existing?: string;
};

type AllowedLabelTypes = "type" | "scope" | "📦";

const printNameMap: Record<LabelType, AllowedLabelTypes> = {
  changeTypes: "type",
  scopes: "📦",
};

const parseNameMap: Record<string, LabelType> = {
  type: "changeTypes",
  scope: "scopes",
  "📦": "scopes",
};

const printName = (type: LabelType, key: string) => {
  if (type === "changeTypes") {
    return `${printNameMap[type]}/${key}`;
  }

  return `${printNameMap[type]} ${key}`;
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
  original: string
): Label | undefined => {
  const [prefix, sub, ...rest] = original
    .replaceAll(":", "")
    .replaceAll(" ", "")
    .split("/");

  if (rest.length) {
    throw new Error(
      `invalid label ${original}. only one '/' is allowed in labels for ${sub}`
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
    `invalid label ${original}. key ${sub} could not be found on object with fields: ${fields}`
  );
};

function normalizeColor(color: string): string {
  return color.replace(/^#/, "").trim().toUpperCase();
}

export const createLabel = (
  type: LabelType,
  key: string,
  longName: string,
  existing?: string
): Label => ({
  type,
  key,
  color: normalizeColor(colors[key] || colors.pkg),
  description:
    type === "changeTypes"
      ? `Relasy type label for versioning & changelog: ${longName}`
      : `Relasy scope label for grouping changes: "${longName}"`,
  name: printName(type, key),
  existing: existing,
});

export const parseLabels = <T extends LabelType>(
  config: Config,
  target: T,
  labels: string[]
): Array<keyof Config[T]> =>
  labels
    .map((label) => parseLabel(config, label))
    .filter((label): label is Label => label?.type === target)
    .map((label) => label.key as keyof Config[T]);
