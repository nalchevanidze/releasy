import fs from "node:fs";
import fg from "fast-glob";
import { NPMManager } from "../config";
import { Module } from "./types";
import { exec } from "../utils";
import { Version } from "../version";

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
      'Root package.json must contain "workspaces": ["..."] or "workspaces": { "packages": ["..."] }.',
    );
  }

  if (patterns.length === 0) throw new Error("workspaces patterns are empty.");

  const pkgJsonGlobs = patterns.map((p: string) =>
    p.endsWith("/package.json") ? p : `${p}/package.json`,
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

type PackageManager = "pnpm" | "yarn" | "npm";

const detectPackageManager = (): PackageManager => {
  if (fs.existsSync("pnpm-lock.yaml")) return "pnpm";
  if (fs.existsSync("yarn.lock")) return "yarn";
  return "npm";
};

const defaultBuildCommand = (pm: PackageManager) => {
  if (pm === "pnpm") return "pnpm run build";
  if (pm === "yarn") return "yarn build";
  return "npm run build";
};

export class NpmModule implements Module {
  constructor(private config: NPMManager) {}

  version() {
    return Version.parse(readJson("package.json").version);
  }

  bump = async (option: "major" | "minor" | "patch") => {
    const args = {
      major: "major",
      minor: "minor",
      patch: "patch",
    };

    await exec(`npm version ${args[option]} --no-git-tag-version`);
  };

  async postBump() {
    await setup();

    const buildCommand =
      this.config.postBump ??
      this.config.build ??
      defaultBuildCommand(detectPackageManager());

    await exec(buildCommand);
  }

  pkg(id: string): string {
    return `https://www.npmjs.com/package/${id}`;
  }
}
