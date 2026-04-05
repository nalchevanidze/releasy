import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = ".github/workflows";
const files = readdirSync(dir).filter(
  (f) => f.endsWith(".yml") || f.endsWith(".yaml"),
);

const missingPermissions = [];
const invalidRunSteps = [];

for (const file of files) {
  const content = readFileSync(join(dir, file), "utf8");

  if (!/^permissions:/m.test(content)) {
    missingPermissions.push(file);
  }

  const lines = content.split("\n");
  lines.forEach((line, index) => {
    if (/^\s*run:\s*(#.*)?$/.test(line)) {
      invalidRunSteps.push(`${file}:${index + 1}`);
    }
  });
}

if (missingPermissions.length > 0) {
  console.error(
    `[security] The following workflows are missing a top-level permissions block: ${missingPermissions.join(", ")}`,
  );
  process.exit(1);
}

if (invalidRunSteps.length > 0) {
  console.error(
    `[security] Invalid workflow steps with empty/null run commands detected at: ${invalidRunSteps.join(", ")}`,
  );
  process.exit(1);
}

console.log(
  `[security] Workflow checks passed (${files.length} files): permissions + non-empty run commands.`,
);
