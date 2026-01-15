import { Config, LabelType } from "./config";

export type Label = {
  type: LabelType;
  name: string;
  color: string; // hex without #
  description?: string;
  existing?: string;
};

const colors: Record<string, string> = {
  major: "B60205", // red (GitHub danger)
  breaking: "B60205", // red (same as major)
  feature: "0E8A16", // green
  fix: "1D76DB", // blue
  minor: "D4DADF", // light gray
  chore: "D4DADF", // light gray
  pkg: "c2e0c6", // teal (package scope / grouping)
};

const prefixMap = {
  changeTypes: "type",
  scopes: "scope",
};

export const createLabel = (
  type: LabelType,
  name: string,
  longName: string,
  existing?: string
): Label => ({
  type,
  name: `${prefixMap[type]}/${name}`,
  color: colors[name] || colors.pkg,
  description:
    type === "changeTypes"
      ? `Relasy type label for versioning & changelog: ${longName}`
      : `Relasy scope label for grouping changes: "${longName}"`,
  existing: existing,
});

const parseLabelId = <T extends LabelType>(
  config: Config,
  t: T,
  label: string
): keyof Config[T] | undefined => {
  const values: Record<string, unknown> = config[t];
  const [prefix, key, ...rest] = label.split("/");

  if (rest.length) {
    throw new Error(
      `invalid label ${label}. only one '/' is allowed in labels for ${t}`
    );
  }

  if (key === undefined) {
    if (values[prefix] && t === "changeTypes") return prefix as keyof Config[T];

    return undefined;
  }

  if (prefix !== prefixMap[t]) return undefined;

  if (values[key]) return key as keyof Config[T];

  const fields = Object.keys(values).join(", ");

  throw new Error(
    `invalid label ${label}. key ${key} could not be found on object with fields: ${fields}`
  );
};

const parseLabel = <T extends LabelType>(
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
    const name = prefix as keyof Config["changeTypes"];
    const longName = config.changeTypes[name];

    if (longName) return createLabel("type", name, longName, original);

    return undefined;
  }

  if (!(prefix in config)) return;

  const type = prefix as LabelType;
  const values: Record<string, unknown> = config[type];

  if (values[sub]) {
    return createLabel(prefixMap[type], sub, values[sub] as string, original);
  }

  const fields = Object.keys(values).join(", ");

  throw new Error(
    `invalid label ${original}. key ${sub} could not be found on object with fields: ${fields}`
  );
};

export const parseLabels = <T extends LabelType>(
  config: Config,
  t: T,
  labels: string[]
): Array<keyof Config[T]> =>
  labels
    .map((label) => parseLabelId(config, t, label))
    .filter((x) => x !== undefined) as Array<keyof Config[T]>;
