import { Config, LabelType } from "../config";
import { Label, parseLabel } from "./parse";
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
