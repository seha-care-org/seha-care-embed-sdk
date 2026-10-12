import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { run, runNpm } from "./ci-process.mjs";

assert.ok(process.argv[2], "Usage: npm run check:package-runtime -- path/to/package.tgz");
const tarball = resolve(process.argv[2]);
const checksum = await readFile(resolve(dirname(tarball), "package.sha256"), "utf8");
const actual = createHash("sha256").update(await readFile(tarball)).digest("hex");
assert.equal(checksum.trim(), `${actual}  ${basename(tarball)}`, "Release package checksum mismatch");

const directory = await mkdtemp(resolve(tmpdir(), "seha-package-runtime-"));
try {
  await writeFile(resolve(directory, "package.json"), JSON.stringify({ private: true, type: "module" }));
  runNpm(["install", "--ignore-scripts", "--no-audit", "--no-fund", "--omit=peer", tarball], { cwd: directory });
  const installed = JSON.parse(await readFile(resolve(directory, "node_modules/@seha-care/embed-sdk/package.json"), "utf8"));
  for (const name of ["react", "@angular/core", "server-only"]) {
    await assert.rejects(readFile(resolve(directory, `node_modules/${name}/package.json`)), { code: "ENOENT" });
  }
  await writeFile(resolve(directory, "consumer.mjs"), `
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { SehaCareEmbedClient as ESM, validateStartSessionOptions } from "@seha-care/embed-sdk/server";
import { SehaCareEmbedClient as Browser } from "@seha-care/embed-sdk/client";
const { SehaCareEmbedClient: CJS } = createRequire(import.meta.url)("@seha-care/embed-sdk/server");
const sessionUrl = "https://demo.seha-care.com/en/embed/session/synthetic-package-session";
const requests = [];
delete process.env.SEHA_API_BASE_URL;
globalThis.fetch = async (url, request) => {
  requests.push({ url, request });
  return Response.json({ sessionUrl });
};
for (const Client of [ESM, CJS]) {
  assert.deepEqual(await new Client("synthetic-package-key").startSession({ language: "ar" }), { sessionUrl });
  const { url, request } = requests.at(-1);
  assert.equal(url, "https://demo.seha-care.com/api/v1/session/embed/start-session");
  assert.equal(request.headers["x-tenant-api-key"], "synthetic-package-key");
  assert.equal(request.redirect, "manual");
  assert.deepEqual(JSON.parse(request.body), { language: "ar" });
}
assert.deepEqual(validateStartSessionOptions({ initAgent: "knowledge" }), { initAgent: "knowledge" });
globalThis.location = { origin: "http://localhost:3000" };
assert.deepEqual(await new Browser().startSession({ language: "en" }), { sessionUrl });
assert.equal(requests.length, 3);
assert.equal(requests[2].url, "http://localhost:3000/api/seha-care/session");
assert.equal(requests[2].request.headers["x-tenant-api-key"], undefined);
console.log("Installed package: ESM, CommonJS, and browser clients passed without framework dependencies.");
`);
  run(process.execPath, [resolve(directory, "consumer.mjs")], { cwd: directory });
  // The browser condition must block resolving the server and Next.js entries.
  await writeFile(resolve(directory, "browser-conditions.mjs"), `
import assert from "node:assert/strict";
for (const entry of ["server", "nextjs"]) {
  await assert.rejects(import("@seha-care/embed-sdk/" + entry), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" });
}
await import("@seha-care/embed-sdk/client");
`);
  run(process.execPath, ["--conditions=browser", resolve(directory, "browser-conditions.mjs")], { cwd: directory });
  console.log(`Runtime checks passed for ${installed.name}@${installed.version} on ${process.version} (${process.platform}).`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
