import { Result, fail, ok } from "./result";
import { Config, ConfigSchema, normalizeConfigInputKeys } from "../lib/config";

export const validateConfig = (input: unknown): Result<Config> => {
  try {
    const normalized = normalizeConfigInputKeys(input);
    const parsed = ConfigSchema.parse(normalized) as Config;
    return ok(parsed);
  } catch (error) {
    return fail(
      "INVALID_CONFIG",
      error instanceof Error ? error.message : String(error),
    );
  }
};
