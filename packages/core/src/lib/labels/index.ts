import { Config } from "../config";
import { ChangeTypeLabel, PkgLabel } from "./label";
import { createLabel, parseLabel } from "./parse";

export const genLabels = (config: Config, ls: string[]) => {
  const changeTypes: Map<string, ChangeTypeLabel> = new Map();
  const pkgs: Map<string, PkgLabel> = new Map();

  ls.forEach((l) => {
    const parsed = parseLabel(config, l);
    switch (parsed?.type) {
      case "changeTypes":
        changeTypes.set(parsed.name, parsed);
        break;
      case "pkgs":
        pkgs.set(parsed.name, parsed);
        break;
    }
  });

  Object.entries(config.changeTypes).forEach(([name, longName]) => {
    const l = createLabel("changeTypes", name, longName) as ChangeTypeLabel;
    if (!changeTypes.has(l.name)) {
      changeTypes.set(l.name, l);
    }
  });

  Object.entries(config.pkgs).forEach(([name, pkg]) => {
    const l = createLabel("pkgs", name, pkg.name) as PkgLabel;
    if (!pkgs.has(l.name)) {
      pkgs.set(l.name, l);
    }
  });

  return [...changeTypes.values(), ...pkgs.values()];
};

export const parseLabels = (
  config: Config,
  labels: string[],
): { changeTypes: ChangeTypeLabel[]; pkgs: PkgLabel[] } => {
  const ls = labels
    .map((label) => {
      try {
        return parseLabel(config, label);
      } catch (error) {
        if ((config.labelPolicy ?? "strict") === "permissive") {
          return undefined;
        }

        throw error;
      }
    })
    .filter(Boolean);

  return {
    changeTypes: ls.filter(
      (x) => x?.type === "changeTypes",
    ) as ChangeTypeLabel[],
    pkgs: ls.filter((x) => x?.type === "pkgs") as PkgLabel[],
  };
};
