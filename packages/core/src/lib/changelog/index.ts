import { FetchApi } from "./fetch";
import { RenderAPI } from "./render";
import { isBreaking } from "./types";
import { Github } from "../gh";
import { Config } from "../config";
import { Module } from "../module/types";

export const renderChangelog = async (
  config: Config,
  module: Module,
  github: Github,
  version: string
) => {
  const fetch = new FetchApi(config, github, module);
  const render = new RenderAPI(config, github, module);
  const changes = await fetch.changes(version);
  await module.next(isBreaking(changes));
  return render.changes(module.version(), changes);
};
