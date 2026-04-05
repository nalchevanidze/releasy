import { readFile } from "fs/promises";
import { remote } from "../git";
import { defaultChangeTypes } from "./defaults";
import { ChangeType, ConfigSchema, RawConfig } from "./schema";

type ExtraConfig = {
  gh: string;
  changeTypes: Record<ChangeType, string>;
  labelPolicy?: "strict" | "permissive";
};

export type Config = RawConfig & ExtraConfig;

export const loadConfig = async (): Promise<Config> => {
  const data = await readFile("./relasy.json", "utf8").then(JSON.parse);
  const config = ConfigSchema.parse(data);
  const gh = remote();

  return {
    ...config,
    gh,
    labelPolicy: config.labelPolicy ?? "strict",
    changeTypes: defaultChangeTypes,
  };
};
