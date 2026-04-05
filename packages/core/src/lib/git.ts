import { execFile } from "./utils";
import { Version } from "./version";

const git = (...cmd: string[]) => execFile("git", cmd);

export const remote = () => {
  const url = git("remote", "get-url", "origin").trim();
  const path = url
    .replace(/\.git$/, "")
    .replace(/^.*github.com/, "")
    .split(":")
    .join("/")
    .replace(/^\/+/, "");
  return path;
};

const getDate = () => git("log", "-1", "--format=%cd", "--date=short");
export const lastTag = () => git("describe", "--abbrev=0", "--tags");

const commitsAfter = (tag: string) =>
  git("rev-list", "--reverse", `${tag}..`).split("\n").filter(Boolean);

const commitsAll = () =>
  git("rev-list", "--reverse", "HEAD").split("\n").filter(Boolean);

const isUserSet = () => {
  try {
    const user = `${git("config", "user.name")}${git(
      "config",
      "user.email",
    )}`.trim();

    return user.length > 0;
  } catch {
    return false;
  }
};

export const commitsAfterVersion = (version: Version) => {
  try {
    return commitsAfter(version.toString());
  } catch {
    try {
      return commitsAfter(version.value);
    } catch {
      return commitsAll();
    }
  }
};

export { git, getDate, isUserSet };
