import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

// Run npm through Node so the helpers work on Windows as well as Unix.
const npmCli = process.env.npm_execpath;

export function runNpm(args, options = {}) {
  assert.ok(npmCli, "Run CI helpers through the corresponding npm run script.");
  return run(process.execPath, [npmCli, ...args], options);
}

export function run(command, args, { capture = false, ...options } = {}) {
  const result = spawnSync(command, args, {
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed (${result.status ?? result.signal})`);
  }
  return result.stdout;
}
