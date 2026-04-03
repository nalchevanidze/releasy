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
  const version = api.module.version();

  try {
    version.isEqual(lastTag());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!message.includes("No names found")) {
      throw new Error(
        `Unable to continue release. package.json version must match the last git tag. Root cause: ${message}`,
      );
    }
  }

  const changes = await new FetchApi(api).changes(version);

  await api.module.bump(detectChangeType(changes));

  return new RenderAPI(api).changes(api.module.version(), changes);
};
