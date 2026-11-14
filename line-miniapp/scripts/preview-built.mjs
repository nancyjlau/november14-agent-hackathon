import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

// Keep the generated deployment artifact unchanged. A root-level local config
// lets Wrangler read the project's ignored .dev.vars rather than dist/server/.
const root = process.cwd();
const built = resolve(root, "dist/server");
const config = JSON.parse(await readFile(resolve(built, "wrangler.json"), "utf8"));
config.main = resolve(built, config.main);
if (config.assets?.directory) config.assets.directory = resolve(built, config.assets.directory);
if (config.build) config.build.watch_dir = built;
const localConfig = resolve(root, ".wrangler-preview.json");
await writeFile(localConfig, JSON.stringify(config));
const child = spawn(process.execPath, [
  "--import", resolve(root, "scripts/sites-env.mjs"),
  resolve(root, "node_modules/wrangler/bin/wrangler.js"), "dev",
  "--config", localConfig, "--local", "--persist-to", ".wrangler/state",
  "--ip", "127.0.0.1", "--inspector-port", "0", ...process.argv.slice(2),
], { stdio: "inherit", env: process.env });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (status) => process.exit(status ?? 1));
