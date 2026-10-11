import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const sdkRoot = fileURLToPath(new URL("..", import.meta.url));
const tenantKey = "synthetic-example-smoke-key";
const sessionUrl = "https://demo.seha-care.com/en/embed/session/synthetic-example-session";

async function unusedPort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a TCP port");
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
  return address.port;
}

async function smokeExample(name, relativeDirectory, entryFile, args = []) {
  const directory = resolve(sdkRoot, relativeDirectory);
  const upstreamPort = await unusedPort();
  const appPort = await unusedPort();
  let upstreamCalls = 0;
  const upstream = createServer((request, response) => {
    if (request.method !== "POST" || request.url !== "/api/v1/session/embed/start-session") {
      response.writeHead(404).end();
      return;
    }
    if (request.headers["x-tenant-api-key"] !== tenantKey) {
      response.writeHead(401).end();
      return;
    }
    upstreamCalls += 1;
    request.resume();
    response.writeHead(201, {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    });
    response.end(JSON.stringify({ sessionUrl }));
  });
  await new Promise((resolveListen, reject) => {
    upstream.once("error", reject);
    upstream.listen(upstreamPort, "127.0.0.1", resolveListen);
  });

  const app = spawn(process.execPath, [entryFile, ...args], {
    cwd: directory,
    env: {
      ...process.env,
      PORT: String(appPort),
      SEHA_API_BASE_URL: `http://127.0.0.1:${upstreamPort}`,
      SEHA_TENANT_API_KEY: tenantKey,
    },
    stdio: ["ignore", "ignore", "pipe"],
    windowsHide: true,
  });
  let diagnostics = "";
  app.stderr.setEncoding("utf8").on("data", (chunk) => { diagnostics += chunk; });

  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (app.exitCode !== null) throw new Error(`${name} exited early: ${diagnostics}`);
      try {
        await fetch(`http://127.0.0.1:${appPort}/`);
        ready = true;
        break;
      } catch {
        await delay(100);
      }
    }
    if (!ready) throw new Error(`${name} did not start: ${diagnostics}`);

    const endpoint = `http://127.0.0.1:${appPort}/api/seha-care/session`;
    const invalid = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initAgent: "unsupported" }),
    });
    assert.equal(invalid.status, 400, `${name} should reject invalid options`);
    assert.equal(upstreamCalls, 0, `${name} must validate before calling Seha Care`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initAgent: "knowledge", initDialect: "EGY" }),
    });
    assert.equal(response.status, 201, `${name} should return a created session`);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/i);
    assert.deepEqual(await response.json(), { sessionUrl });
    assert.equal(upstreamCalls, 1, `${name} should make exactly one authorized upstream request`);
    assert.equal(diagnostics.includes(tenantKey), false, `${name} must not log the tenant key`);
    console.log(`${name} server example passed its mocked-session smoke check.`);
  } finally {
    app.kill();
    await new Promise((resolveClose) => upstream.close(resolveClose));
  }
}

await smokeExample(
  "Express",
  "examples/react-demo",
  "node_modules/tsx/dist/cli.mjs",
  ["server/index.ts"],
);
await smokeExample(
  "NestJS",
  "examples/angular-nest/server",
  "dist/main.js",
);
await smokeExample(
  "Plain Node.js",
  "examples/plain-node",
  "server.mjs",
);
