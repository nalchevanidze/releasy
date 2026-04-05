import {
  execSync,
  exec as execProcess,
  execFileSync,
  execFile as execFileProcess,
} from "node:child_process";
import { promisify } from "node:util";

const options = {
  maxBuffer: 10 * 1024 * 1024, // 10MB
  encoding: "utf-8",
} as const;

export const isKey = <T extends string>(
  obj: Record<T, unknown>,
  key?: string | null,
): key is T => typeof key === "string" && key in obj;

export const exec = (command: string) => execSync(command, options)?.trimEnd();

export const execFile = (file: string, args: string[]) =>
  execFileSync(file, args, options)?.trimEnd();

export const execVoid = (cmd: string) =>
  promisify(execProcess)(cmd, options).then(({ stdout }) =>
    console.log(stdout),
  );

export const execFileVoid = (file: string, args: string[]) =>
  promisify(execFileProcess)(file, args, options).then(({ stdout }) =>
    console.log(stdout),
  );

export const exit = (error: Error) => {
  console.log(error.message);
  process.exit(1);
};

export const setupEnv = () => {
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_API_TOKEN;
  if (!token) throw new Error("Missing GITHUB_TOKEN (or GITHUB_API_TOKEN).");

  // provide both names for compatibility
  process.env.GITHUB_TOKEN = process.env.GITHUB_TOKEN || token;
  process.env.GITHUB_API_TOKEN = process.env.GITHUB_API_TOKEN || token;

  // run in the checked-out repo
  const cwd = process.env.GITHUB_WORKSPACE || process.cwd();
  process.chdir(cwd);
};
