import { lastTag } from "../git";
import { FetchApi } from "./fetch";
import { RenderAPI } from "./render";
import { Api, Change } from "./types";

const detectChangeType = (changes: Change[]) => {
  if (changes.find((c) => c.type === "breaking")) {
    return "major";
  }

  if (changes.find((c) => c.type === "feature")) {
    return "minor";
  }

  return "patch";
};

export const renderChangelog = async (api: Api) => {
  const version = lastTag();
  const projectVersion = api.module.version();

  if (version.replace(/^v/, "") !== projectVersion.replace(/^v/, "")) {
    throw Error(`versions does not match: ${version} ${projectVersion}`);
  }

  const changes = await new FetchApi(api).changes(version);

  await api.module.next(detectChangeType(changes));

  return new RenderAPI(api).changes(api.module.version(), changes);
};
