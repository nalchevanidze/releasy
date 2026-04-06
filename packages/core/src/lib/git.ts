import { execFile } from "./utils";
import { Version } from "./version";

const git = (...cmd: string[]) => execFile("git", cmd);

const splitLines = (txt: string) => txt.split("\n").filter(Boolean);

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
export const dateAtRef = (ref: string) =>
  git("log", "-1", "--format=%cd", "--date=short", ref);

export const listTags = () =>
  splitLines(git("tag", "--sort=creatordate")).filter(Boolean);

export const lastTag = () => git("describe", "--abbrev=0", "--tags");

const commitsAfter = (ref: string) =>
  splitLines(git("rev-list", "--reverse", `${ref}..`));

const commitsAll = () => splitLines(git("rev-list", "--reverse", "HEAD"));

export const commitsAfterRef = (ref: string) => commitsAfter(ref);

export const commitsBetweenRefs = (
  fromExclusive: string | undefined,
  to: string,
) =>
  fromExclusive
    ? splitLines(git("rev-list", "--reverse", `${fromExclusive}..${to}`))
    : splitLines(git("rev-list", "--reverse", to));

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
