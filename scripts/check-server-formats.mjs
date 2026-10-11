import assert from "node:assert/strict";
import { createRequire } from "node:module";

const imported = await import("../dist/server/index.js");
const require = createRequire(import.meta.url);
const required = require("@seha-care/embed-sdk/server");

assert.equal(typeof imported.SehaCareEmbedClient, "function");
assert.equal(typeof required.SehaCareEmbedClient, "function");
assert.equal(typeof imported.validateStartSessionOptions, "function");
assert.equal(typeof required.validateStartSessionOptions, "function");

for (const Client of [imported.SehaCareEmbedClient, required.SehaCareEmbedClient]) {
  const client = new Client("synthetic-format-check-key", {
    apiBaseUrl: "https://demo.seha-care.com",
  });
  assert.equal(typeof client.startSession, "function");
}

console.log("/server exports load through both ESM and CommonJS package conditions.");
