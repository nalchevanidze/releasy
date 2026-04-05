export type ResultCode =
  | "OK"
  | "INVALID_CONFIG"
  | "LABEL_POLICY_ERROR"
  | "RELEASE_FAILED"
  | "UNKNOWN_ERROR";

export type Success<T> = { ok: true; code: "OK"; data: T };
export type Failure = { ok: false; code: Exclude<ResultCode, "OK">; message: string };

export type Result<T> = Success<T> | Failure;

export const ok = <T>(data: T): Success<T> => ({ ok: true, code: "OK", data });

export const fail = (
  code: Exclude<ResultCode, "OK">,
  message: string,
): Failure => ({ ok: false, code, message });
