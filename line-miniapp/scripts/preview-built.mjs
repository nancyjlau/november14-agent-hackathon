import { access, chmod, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";

// Runtime credentials live outside the checkout and deployment artifact.
// Wrangler loads .dev.vars alongside this external local configuration.
const root = process.cwd();
const built = resolve(root, "dist/server");
const runtimeDir = resolve(process.env.RIZZ_RUNTIME_DIR || resolve(homedir(), ".config/rizz-et-al"));
if (runtimeDir === root || runtimeDir.startsWith(root + "/")) {
  throw new Error("RIZZ_RUNTIME_DIR must be outside the repository.");
}
await mkdir(runtimeDir, { recursive: true, mode: 0o700 });
const runtimeSecrets = resolve(runtimeDir, ".dev.vars");
try { await access(runtimeSecrets); }
catch {
  try { await copyFile(resolve(root, ".dev.vars"), runtimeSecrets); }
  catch { await copyFile(resolve(root, ".dev.vars.example"), runtimeSecrets); }
}
await chmod(runtimeSecrets, 0o600);
const config = JSON.parse(await readFile(resolve(built, "wrangler.json"), "utf8"));
config.main = resolve(built, config.main);
if (config.assets?.directory) config.assets.directory = resolve(built, config.assets.directory);
if (config.build) config.build.watch_dir = built;
const localConfig = resolve(runtimeDir, "wrangler-preview.json");
await writeFile(localConfig, JSON.stringify(config));
console.log(`Runtime secrets file: ${runtimeSecrets}`);
const child = spawn(process.execPath, [
  "--import", resolve(root, "scripts/sites-env.mjs"),
  resolve(root, "node_modules/wrangler/bin/wrangler.js"), "dev",
  "--config", localConfig, "--local", "--persist-to", resolve(root, ".wrangler/state"),
  "--ip", "127.0.0.1", "--inspector-port", "0", ...process.argv.slice(2),
], { stdio: "inherit", env: process.env });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (status) => process.exit(status ?? 1));
