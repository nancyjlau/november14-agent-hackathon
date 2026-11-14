import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";

await mkdir("outputs", { recursive: true });
await build({
  entryPoints: ["tests/core.test.mjs"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "outputs/core.test.mjs",
  plugins: [{
    name: "isolated-test-worker-environment",
    setup(builder) {
      builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({
        path: "env", namespace: "test-environment",
      }));
      builder.onLoad({ filter: /.*/, namespace: "test-environment" }, () => ({
        contents: "globalThis.__rizzEnv ??= {}; export const env = globalThis.__rizzEnv;",
      }));
    },
  }],
});
const result = spawnSync(process.execPath, ["--test", "outputs/core.test.mjs"], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
