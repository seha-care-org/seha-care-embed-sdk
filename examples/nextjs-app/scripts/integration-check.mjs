import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const host = "127.0.0.1";
const appPort = 4199;
const upstreamPort = 4200;
const tenantKey = "synthetic-test-tenant-key-not-a-secret";
const sessionUrl = "https://demo.seha-care.com/en/embed/session/test-session-token";
let upstreamSessionCount = 0;

const upstream = createServer((request, response) => {
  if (request.method !== "POST" || request.url !== "/api/v1/session/embed/start-session") {
    response.writeHead(404).end();
    return;
  }
  if (request.headers["x-tenant-api-key"] !== tenantKey) {
    response.writeHead(401, { "Cache-Control": "no-store" }).end();
    return;
  }
  upstreamSessionCount += 1;
  request.resume();
  response.writeHead(201, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify({ sessionUrl }));
});

await new Promise((resolve, reject) => {
  upstream.once("error", reject);
  upstream.listen(upstreamPort, host, resolve);
});

const exampleDirectory = fileURLToPath(new URL("..", import.meta.url));
const nextExecutable = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const developmentMode = process.argv.includes("--dev");
const app = spawn(
  process.execPath,
  [nextExecutable, developmentMode ? "dev" : "start", "--hostname", host, "--port", String(appPort)],
  {
    cwd: exampleDirectory,
    env: {
      ...process.env,
      SEHA_API_BASE_URL: `http://${host}:${upstreamPort}`,
      SEHA_TENANT_API_KEY: tenantKey,
    },
    stdio: "pipe",
    windowsHide: true,
  },
);
app.stdout.on("data", (chunk) => process.stdout.write(`[next] ${chunk}`));
app.stderr.on("data", (chunk) => process.stderr.write(`[next] ${chunk}`));

let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (app.exitCode !== null) throw new Error("Next.js exited before it became ready.");
    try {
      const response = await fetch(`http://${host}:${appPort}`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      // The server is still starting.
    }
    await delay(1000);
  }
  if (!ready) throw new Error("Next.js did not become ready.");

  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  const page = await browser.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") console.error(`[browser] ${message.text()}`);
  });
  page.on("pageerror", (error) => console.error(`[browser] ${error.message}`));
  const leakedResponses = [];
  const credentialRequests = [];
  const pendingResponseScans = [];
  page.on("request", (request) => {
    if ("x-tenant-api-key" in request.headers()) credentialRequests.push(request.url());
  });
  page.on("response", (response) => {
    pendingResponseScans.push((async () => {
      try {
        const content = await response.text();
        if (content.includes(tenantKey)) leakedResponses.push(response.url());
      } catch {
        // Browser response bodies such as media are not text.
      }
    })());
  });

  await page.goto(`http://${host}:${appPort}`);
  if (upstreamSessionCount !== 0) throw new Error("Rendering created a session.");
  if ((await page.content()).includes(tenantKey)) throw new Error("Tenant key found in rendered HTML.");

  const publicSection = page.locator("#public-visitor");
  await publicSection.getByRole("button", { name: "Start session" }).click();
  await publicSection.getByTitle("Seha Care visitor consultation").waitFor();
  if (upstreamSessionCount !== 1) throw new Error("Public submit did not create exactly one session.");

  const protectedSection = page.locator("#protected-visitor");
  await protectedSection.scrollIntoViewIfNeeded();
  await protectedSection.getByRole("button", { name: "Start session" }).click();
  await protectedSection.getByRole("alert").waitFor();
  if (upstreamSessionCount !== 1) throw new Error("A denied access hook created a session.");

  await page.context().addCookies([{
    name: "consultation_access",
    value: "allowed",
    url: `http://${host}:${appPort}`,
  }]);
  await protectedSection.getByRole("button", { name: "Start session" }).click();
  await protectedSection.getByTitle("Seha Care consultation").waitFor();
  await Promise.all(pendingResponseScans);
  if (upstreamSessionCount !== 2) throw new Error("Authorized submit did not create a session.");
  if (leakedResponses.length > 0) throw new Error("Tenant key found in a browser response.");
  if (credentialRequests.length > 0) throw new Error("Browser request sent a tenant-key header.");

  console.log(`${developmentMode ? "Development" : "Production"} Next.js integration passed.`);
} finally {
  await browser?.close();
  app.kill();
  await new Promise((resolve) => upstream.close(resolve));
}
