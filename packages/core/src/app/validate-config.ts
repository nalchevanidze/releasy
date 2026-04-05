import { Result, fail, ok } from "./result";
import { Config, ConfigSchema } from "../lib/config";

export const validateConfig = (input: unknown): Result<Config> => {
  try {
    const parsed = ConfigSchema.parse(input) as Config;
    return ok(parsed);
  } catch (error) {
    return fail(
      "INVALID_CONFIG",
      error instanceof Error ? error.message : String(error),
    );
  }
};
