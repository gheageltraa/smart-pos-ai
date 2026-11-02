import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = resolve(root, "../smart-pos-ai-supabase.zip");
mkdirSync(dirname(output), { recursive: true });
if (existsSync(output)) rmSync(output);

const excludedPaths = [
  "node_modules",
  "dist",
  ".git",
  ".manus",
  ".manus-logs",
  "*.zip",
  ".env",
  ".env.*",
  "*/.env",
  "*/.env.*",
];

if (process.platform === "win32") {
  execFileSync(
    "tar",
    [
      "-a",
      "-c",
      "-f",
      output,
      "-C",
      root,
      ...excludedPaths.map(pattern => `--exclude=${pattern}`),
      ".",
    ],
    { stdio: "inherit" }
  );
} else {
  execFileSync(
    "zip",
    ["-r", output, ".", "-x", ...excludedPaths.map(pattern => `${pattern}/*`), ...excludedPaths],
    { cwd: root, stdio: "inherit" }
  );
}

console.log(`Created ${output}`);
