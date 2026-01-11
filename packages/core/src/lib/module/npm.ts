import fs from "node:fs";
import fg from "fast-glob";
import { Module } from "./types";

function readJson(p: string) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function writeJson(p: string, obj: unknown) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
}

export async function setup() {
  const rootPkg = readJson("package.json");
  const rootVersion = rootPkg.version;
  if (!rootVersion)
    throw new Error("Root package.json must have a version field.");

  let patterns = rootPkg.workspaces;
  if (Array.isArray(patterns)) {
    // ok
  } else if (patterns && Array.isArray(patterns.packages)) {
    patterns = patterns.packages;
  } else {
    throw new Error(
      'Root package.json must contain "workspaces": ["..."] or "workspaces": { "packages": ["..."] }.'
    );
  }

  if (patterns.length === 0) throw new Error("workspaces patterns are empty.");

  const pkgJsonGlobs = patterns.map((p: string) =>
    p.endsWith("/package.json") ? p : `${p}/package.json`
  );

  const packageJsonPaths = await fg(pkgJsonGlobs, {
    onlyFiles: true,
    unique: true,
    ignore: ["**/node_modules/**", "**/dist/**", "**/build/**"],
  });

  for (const pkgPath of packageJsonPaths) {
    if (pkgPath.replace(/\\/g, "/") === "package.json") continue;

    const pkg = readJson(pkgPath);
    if (!pkg?.name) continue;

    if (pkg.version !== rootVersion) {
      pkg.version = rootVersion;
      writeJson(pkgPath, pkg);
      console.log(`Synced ${pkg.name} -> ${rootVersion}`);
    }
  }
}

export class NpmModule implements Module {
  version(): string {
    const rootPkg = readJson("package.json");
    return rootPkg.version;
  }

  next = async (isBreaking: boolean) => {
    throw new Error("Method not implemented.");
  };

  async setup() {
    await setup();
  }
}
