import { exec } from "./utils";
import { Version } from "./version";

const git = (...cmd: string[]) => exec(["git", ...cmd].join(" "));

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
  git("rev-list", "--reverse", `${tag}..`).split("\n");

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
    return commitsAfter(version.value);
  }
};

export { git, getDate, isUserSet };
