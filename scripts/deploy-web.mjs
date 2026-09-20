// Deploy the current frontend as a complete snapshot, never a partial refresh.
// Use --check to detect stale files without copying or deploying.
import { readdirSync, readFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve, relative, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const staging = join(root, ".data/token-ui-deploy");
const checkOnly = process.argv.includes("--check");
const trees = ["apps/web/app", "apps/web/components", "apps/web/lib", "apps/web/public", "packages/config"];
const configs = ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "turbo.json",
  ...["package.json", "next.config.ts", "postcss.config.mjs", "tsconfig.json", "components.json", "vercel.json"].map(name => `apps/web/${name}`)];
function files(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
const sources = [...trees.flatMap(tree => files(join(root, tree))), ...configs.map(path => join(root, path)).filter(existsSync)];
const expected = new Set(sources.map(path => relative(root, path)));
const obsolete = trees.flatMap(tree => files(join(staging, tree)))
  .map(path => relative(staging, path)).filter(path => !expected.has(path));
if (obsolete.length) throw new Error(`Obsolete deployment files require review:\n${obsolete.join("\n")}`);
const stale = sources.filter(source => {
  const target = join(staging, relative(root, source));
  return !existsSync(target) || !readFileSync(source).equals(readFileSync(target));
});
if (checkOnly) {
  if (stale.length) throw new Error(`Deployment snapshot is stale:\n${stale.map(path => relative(root, path)).join("\n")}`);
  console.log(`Deployment snapshot matches all ${sources.length} source files.`);
} else {
  for (const source of sources) {
    const target = join(staging, relative(root, source));
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
  }
  console.log(`Synchronized all ${sources.length} source files (${stale.length} updated).`);
  const result = spawnSync("pnpm", ["dlx", "vercel", "deploy", "--prod", "--yes", "--cwd", ".data/token-ui-deploy"], {
    cwd: root, stdio: "inherit", shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
