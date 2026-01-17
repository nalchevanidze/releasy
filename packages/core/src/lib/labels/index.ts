import { Config, LabelType } from "../config";
import { ChangeTypeLabel, Label, ScopeLabel } from "./label";
import { createLabel, parseLabel } from "./parse";

export const genLabels = (config: Config, ls: string[]) => {
  const changeTypes: Map<string, ChangeTypeLabel> = new Map();
  const scopes: Map<string, ScopeLabel> = new Map();

  ls.forEach((l) => {
    const parsed = parseLabel(config, l);
    switch (parsed?.type) {
      case "changeTypes":
        changeTypes.set(parsed.name, parsed);
        break;
      case "scopes":
        scopes.set(parsed.name, parsed);
        break;
    }
  });

  Object.entries(config.changeTypes).forEach(([name, longName]) => {
    const l = createLabel("changeTypes", name, longName);
    if (!changeTypes.has(l.name)) {
      changeTypes.set(l.name, l);
    }
  });

  Object.entries(config.scopes).forEach(([name, longName]) => {
    const l = createLabel("scopes", name, longName);
    if (!scopes.has(l.name)) {
      scopes.set(l.name, l);
    }
  });

  return [...changeTypes.values(), ...scopes.values()];
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
