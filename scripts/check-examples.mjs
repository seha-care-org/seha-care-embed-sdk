import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runNpm } from "./ci-process.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const groups = {
  react: ["examples/react-demo"],
  angular: ["examples/angular-nest/client"],
  nextjs: ["examples/nextjs-app"],
  servers: ["examples/react-demo", "examples/angular-nest/server", "examples/plain-node"],
};
const [group, input] = process.argv.slice(2);
assert.ok(Object.hasOwn(groups, group), "Choose an example group: react, angular, nextjs, servers");
assert.ok(input, "Supply the checked package tarball as the second argument");
const tarball = resolve(input);
const checksum = await readFile(resolve(dirname(tarball), "package.sha256"), "utf8");
const actual = createHash("sha256").update(await readFile(tarball)).digest("hex");
assert.equal(checksum.trim(), `${actual}  ${basename(tarball)}`, "Release package checksum mismatch");

const environment = {
  ...process.env,
  CI: "true",
  NEXT_TELEMETRY_DISABLED: "1",
  SEHA_TENANT_API_KEY: "synthetic-ci-bundle-scan-key",
  SEHA_API_BASE_URL: "http://127.0.0.1:9",
};
for (const relative of groups[group]) {
  const cwd = resolve(root, relative);
  const lockfile = await readFile(resolve(cwd, "package-lock.json"));
  const manifest = await readFile(resolve(cwd, "package.json"));
  runNpm(["ci", "--no-audit", "--no-fund"], { cwd, env: environment });
  // Replace file: links with the artifact: builds must consume the package we checked.
  runNpm(["install", "--no-save", "--package-lock=false", "--ignore-scripts", "--no-audit", "--no-fund", tarball],
    { cwd, env: environment });
  const installedPath = resolve(cwd, "node_modules/@seha-care/embed-sdk");
  assert.equal(await realpath(installedPath), installedPath, "Example must use an installed tarball, not a repository link");
  assert.deepEqual(await readFile(resolve(cwd, "package-lock.json")), lockfile, "Example lockfile changed");
  assert.deepEqual(await readFile(resolve(cwd, "package.json")), manifest, "Example manifest changed");

  if (group === "react") {
    runNpm(["test", "--", "--reporter=default", "--reporter=junit", "--outputFile.junit=reports/unit.xml"], { cwd, env: environment });
    runNpm(["run", "check:bundle"], { cwd, env: environment });
  } else if (group === "angular") {
    runNpm(["run", "check:bundle"], { cwd, env: environment });
  } else if (group === "nextjs") {
    runNpm(["run", "build"], { cwd, env: environment });
    runNpm(["run", "check:bundle"], { cwd, env: environment });
  } else if (relative.endsWith("/server")) {
    runNpm(["run", "build"], { cwd, env: environment });
  }
}
if (group === "servers") runNpm(["run", "check:server-examples"], { cwd: root, env: environment });
