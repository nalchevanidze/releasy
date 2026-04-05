import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = ".github/workflows";
const files = readdirSync(dir).filter(
  (f) => f.endsWith(".yml") || f.endsWith(".yaml"),
);

const missing = files.filter((file) => {
  const content = readFileSync(join(dir, file), "utf8");
  return !/^permissions:/m.test(content);
});

if (missing.length > 0) {
  console.error(
    `[security] The following workflows are missing a top-level permissions block: ${missing.join(", ")}`,
  );
  process.exit(1);
}

console.log(
  `[security] Workflow permissions check passed (${files.length} files).`,
);
