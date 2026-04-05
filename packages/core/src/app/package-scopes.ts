import type { IRelasy } from "../index";
import { Result, fail, ok } from "./result";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const globToRegExp = (glob: string): RegExp => {
  const normalized = glob.replace(/\\/g, "/");
  const pattern = normalized
    .split("**")
    .map((part) => part.split("*").map(escapeRegex).join("[^/]*"))
    .join(".*");
  return new RegExp(`^${pattern}$`);
};

const matchesAny = (path: string, patterns: string[]) => {
  const normalized = path.replace(/\\/g, "/");
  return patterns.some((pattern) => globToRegExp(pattern).test(normalized));
};

type IRelasyScopes = Pick<IRelasy, "config" | "parseLabels" | "logger">;

export type ScopeInference = {
  inferredScopes: string[];
  existingScopes: string[];
  missingScopes: string[];
  conflictingScopes: string[];
};

export const inferPackageScopes = (
  iRelasy: IRelasyScopes,
  labels: string[],
  changedFiles: string[],
): ScopeInference => {
  const inferredScopes = Object.entries(iRelasy.config.pkgs)
    .filter(([_, pkg]) => (pkg.paths ?? []).length > 0)
    .filter(([_, pkg]) => matchesAnyInFiles(changedFiles, pkg.paths ?? []))
    .map(([scope]) => scope)
    .sort();

  const existingScopes = iRelasy
    .parseLabels(labels)
    .pkgs.map((p) => p.pkg)
    .sort();

  const missingScopes = inferredScopes.filter(
    (s) => !existingScopes.includes(s),
  );
  const conflictingScopes = existingScopes.filter(
    (s) => !inferredScopes.includes(s),
  );

  return { inferredScopes, existingScopes, missingScopes, conflictingScopes };
};

const matchesAnyInFiles = (changedFiles: string[], patterns: string[]) =>
  changedFiles.some((f) => matchesAny(f, patterns));

const emitWarn = (iRelasy: IRelasyScopes, message: string) => {
  iRelasy.logger?.warn?.(`[relasy] ${message}`);
};

export const evaluatePackageScopeRules = (
  iRelasy: IRelasyScopes,
  labels: string[],
  changedFiles: string[],
): Result<ScopeInference> => {
  const hasPkgPathConfig = Object.values(iRelasy.config.pkgs).some(
    (pkg) => (pkg.paths ?? []).length > 0,
  );

  if (!hasPkgPathConfig) {
    return ok({
      inferredScopes: [],
      existingScopes: [],
      missingScopes: [],
      conflictingScopes: [],
    });
  }

  const { inferredScopes, existingScopes, missingScopes, conflictingScopes } =
    inferPackageScopes(iRelasy, labels, changedFiles);

  const missingRule =
    iRelasy.config.policies?.rules?.inferredPackageMissing ?? "error";
  const conflictRule = iRelasy.config.policies?.rules?.labelConflict ?? "error";

  if (missingScopes.length > 0) {
    const message = `Missing inferred package labels: ${missingScopes
      .map((s) => `📦 ${s}`)
      .join(", ")}`;

    if (missingRule === "error") {
      return fail("LABEL_POLICY_ERROR", message);
    }

    if (missingRule === "warn") {
      emitWarn(iRelasy, message);
    }
  }

  if (conflictingScopes.length > 0) {
    const message = `Package label conflict detected. Labels not inferred from changed files: ${conflictingScopes
      .map((s) => `📦 ${s}`)
      .join(", ")}`;

    if (conflictRule === "error") {
      return fail("LABEL_POLICY_ERROR", message);
    }

    if (conflictRule === "warn") {
      emitWarn(iRelasy, message);
    }
  }

  return ok({
    inferredScopes,
    existingScopes,
    missingScopes,
    conflictingScopes,
  });
};
