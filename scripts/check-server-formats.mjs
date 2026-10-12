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

const previousBaseUrl = process.env.SEHA_API_BASE_URL;
const previousFetch = globalThis.fetch;
const requestedUrls = [];
delete process.env.SEHA_API_BASE_URL;
globalThis.fetch = async (input) => {
  requestedUrls.push(String(input));
  return Response.json({ sessionUrl: "https://demo.seha-care.com/en/embed/session/token" });
};

try {
  for (const Client of [imported.SehaCareEmbedClient, required.SehaCareEmbedClient]) {
    await new Client("synthetic-format-check-key").startSession();
  }
} finally {
  globalThis.fetch = previousFetch;
  if (previousBaseUrl === undefined) {
    delete process.env.SEHA_API_BASE_URL;
  } else {
    process.env.SEHA_API_BASE_URL = previousBaseUrl;
  }
}

assert.deepEqual(requestedUrls, [
  "https://demo.seha-care.com/api/v1/session/embed/start-session",
  "https://demo.seha-care.com/api/v1/session/embed/start-session",
]);

console.log("/server exports load through ESM and CommonJS and use the default API origin.");
