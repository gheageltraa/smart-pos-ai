import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const output = resolve(root, "../smart-pos-ai-supabase.zip");
mkdirSync(dirname(output), { recursive: true });
if (existsSync(output)) execFileSync("rm", ["-f", output]);
execFileSync("zip", ["-r", output, ".", "-x", "node_modules/*", "dist/*", ".git/*", ".manus/*", ".manus-logs/*", "*.zip"], { cwd: root, stdio: "inherit" });
console.log(`Created ${output}`);
