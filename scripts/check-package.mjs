import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runNpm } from "./ci-process.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const output = resolve(root, "artifacts");
await mkdir(output, { recursive: true });

// CI builds explicitly; pack those exact bytes without running prepack again.
const [packed] = JSON.parse(runNpm([
  "pack", "--json", "--ignore-scripts", "--pack-destination", output,
], { cwd: root, capture: true }));
const files = new Set(packed.files.map((file) => file.path));

for (const file of files) {
  assert.ok(
    file.startsWith("dist/") || ["package.json", "README.md", "LICENSE"].includes(file),
    `Unexpected file in release package: ${file}`,
  );
  assert.ok(!/(^|\/)(node_modules|\.env(?:\..*)?|\.git|tests|coverage|reports)(\/|$)/.test(file),
    `Private or development file in release package: ${file}`);
}
for (const file of ["package.json", "README.md", "LICENSE", "dist/react/embed-session.css"]) {
  assert.ok(files.has(file), `Release package is missing ${file}`);
}
function checkTargets(value) {
  if (typeof value === "string") {
    assert.ok(value.startsWith("./dist/"), `Unexpected export target: ${value}`);
    assert.ok(files.has(value.slice(2)), `Release package is missing export target: ${value}`);
  } else if (value !== null && typeof value === "object") {
    for (const target of Object.values(value)) checkTargets(target);
  }
}
checkTargets(manifest.exports);
for (const file of files) {
  if (!file.endsWith(".map")) continue;
  const sourceMap = JSON.parse(await readFile(resolve(root, file), "utf8"));
  assert.ok(Array.isArray(sourceMap.sources), `Invalid source map: ${file}`);
  if (!file.endsWith(".d.ts.map")) {
    assert.equal(sourceMap.sourcesContent?.length, sourceMap.sources.length,
      `JavaScript source map must include source content: ${file}`);
    assert.ok(sourceMap.sourcesContent.every((source) => typeof source === "string"),
      `JavaScript source map has missing source content: ${file}`);
  }
}
for (const file of ["dist/react/index.js", "dist/react/embed-session.js", "dist/react/fullscreen-button.js"]) {
  assert.match(await readFile(resolve(root, file), "utf8"), /^['"]use client['"];?/,
    `${file} must preserve its client directive`);
}
assert.match(await readFile(resolve(root, "dist/nextjs/index.js"), "utf8"), /import ["']server-only["']/);
assert.match(await readFile(resolve(root, "dist/nextjs/index.js"), "utf8"), /["']use server["']/);

const tarball = resolve(output, packed.filename);
const sha256 = createHash("sha256").update(await readFile(tarball)).digest("hex");
await writeFile(resolve(output, "package.sha256"), `${sha256}  ${packed.filename}\n`);
await writeFile(resolve(output, "package.json"), `${JSON.stringify(packed, null, 2)}\n`);
console.log(`Validated ${packed.filename}: ${files.size} files, SHA-256 ${sha256}`);
