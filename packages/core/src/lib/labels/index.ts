import { ChangeType, Config, LabelType } from "../config";
import { ChangeTypeLabel, Label, ScopeLabel } from "./label";
import { createLabel, parseLabel } from "./parse";

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

export const parseLabels = <T extends LabelType>(
  config: Config,
  labels: string[],
): { changeTypes: ChangeTypeLabel[]; scopes: ScopeLabel[] } => {
  const ls = labels.map((label) => parseLabel(config, label));

  return {
    changeTypes: ls.filter(
      (x) => x?.type === "changeTypes",
    ) as ChangeTypeLabel[],
    scopes: ls.filter((x) => x?.type === "scopes") as ScopeLabel[],
  };
};
