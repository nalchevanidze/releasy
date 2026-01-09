import { execSync, exec as execProcess } from "node:child_process";
import { promisify } from "node:util";

const options = {
  maxBuffer: 10 * 1024 * 1024, // 10MB
  encoding: "utf-8",
} as const;

export const isKey = <T extends string>(
  obj: Record<T, unknown>,
  key?: string | null
): key is T => typeof key === "string" && key in obj;

export const exec = (command: string) => execSync(command, options)?.trimEnd();

export const execVoid = (cmd: string) =>
  promisify(execProcess)(cmd, options).then(({ stdout }) =>
    console.log(stdout)
  );

export const exit = (error: Error) => {
  console.log(error.message);
  process.exit(1);
};
