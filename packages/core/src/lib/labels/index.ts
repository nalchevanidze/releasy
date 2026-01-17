import { Config, LabelType } from "../config";
import { createLabel, Label, parseLabel } from "./parse";
export { Label, parseLabel, createLabel } from "./parse";

export const parseLabels = <T extends LabelType>(
  config: Config,
  target: T,
  labels: string[],
): Array<keyof Config[T]> =>
  labels
    .map((label) => parseLabel(config, label))
    .filter((label): label is Label => label?.type === target)
    .map((label) => label.key as keyof Config[T]);

export const genLabels = (config: Config, ls: string[]) => {
  const map = new Map<string, Label>();

  ls.forEach((l) => {
    const parsed = parseLabel(config, l);
    if (parsed) {
      map.set(parsed.name, parsed);
    }
  });

  const add =
    (t: LabelType) =>
    ([n, longName]: [string, string]) => {
      const l = createLabel(t, n, longName);
      if (!map.has(l.name)) {
        map.set(l.name, l);
      }
    };

  Object.entries(config.changeTypes).forEach(add("changeTypes"));
  Object.entries(config.scopes).forEach(add("scopes"));

  return [...map.values()];
};
