import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const host = "127.0.0.1";
const appPort = await unusedPort();
const upstreamPort = await unusedPort();
const tenantKey = "synthetic-test-tenant-key-not-a-secret";
const sessionUrl = "https://demo.seha-care.com/en/embed/session/test-session-token";
let upstreamSessionCount = 0;
const upstreamSessionBodies = [];
let protectedActionPayload;
let protectedActionRequestInfo;

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
  let body = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => { body += chunk; });
  request.on("end", () => {
    upstreamSessionBodies.push(JSON.parse(body));
    response.writeHead(201, {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    });
    response.end(JSON.stringify({ sessionUrl }));
  });
});

async function unusedPort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not reserve an available test port.");
  }
  await new Promise((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose())),
  );
  return address.port;
}

await new Promise((resolve, reject) => {
  upstream.once("error", reject);
  upstream.listen(upstreamPort, host, resolve);
});

const exampleDirectory = fileURLToPath(new URL("..", import.meta.url));
const nextExecutable = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const developmentMode = process.argv.includes("--dev");
const app = spawn(
  process.execPath,
  [
    nextExecutable,
    developmentMode ? "dev" : "start",
    ...(developmentMode ? ["--webpack"] : []),
    "--hostname",
    host,
    "--port",
    String(appPort),
  ],
  {
    cwd: exampleDirectory,
    env: {
      ...process.env,
      SEHA_TENANT_API_KEY: tenantKey,
      SEHA_NEXT_BUILD_DIR: ".next-sdk-integration",
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
  let protectedActionId;
  page.on("request", (request) => {
    if ("x-tenant-api-key" in request.headers()) credentialRequests.push(request.url());
    const requestUrl = new URL(request.url());
    if (
      !protectedActionId &&
      requestUrl.origin === `http://${host}:${appPort}` &&
      requestUrl.pathname === "/" &&
      request.headers()["next-action"]
    ) {
      protectedActionId = request.headers()["next-action"];
      protectedActionPayload =
        request.postData() ?? request.postDataBuffer()?.toString("utf8");
      protectedActionRequestInfo = {
        method: request.method(),
        contentType: request.headers()["content-type"],
        payloadLength: protectedActionPayload?.length ?? 0,
      };
    }
  });
  page.on("response", (response) => {
    const responseUrl = new URL(response.url());
    if (responseUrl.origin !== `http://${host}:${appPort}`) return;
    if (response.request().headers()["next-action"]) return;
    if (!response.ok()) return;
    if (
      response.request().resourceType() !== "document" &&
      responseUrl.pathname !== "/api/seha-care/session"
    ) return;
    pendingResponseScans.push((async () => {
      try {
        const content = await response.text();
        console.log(`Scanned ${response.status()} ${responseUrl.pathname}`);
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
  console.log("Verified public Server Action session.");

  const protectedSection = page.locator("#protected-visitor");
  await protectedSection.scrollIntoViewIfNeeded();
  protectedActionId = undefined;
  protectedActionPayload = undefined;
  protectedActionRequestInfo = undefined;
  await protectedSection.getByRole("button", { name: "Start session" }).click();
  await protectedSection.getByRole("alert").waitFor();
  if (upstreamSessionCount !== 1) throw new Error("A denied access hook created a session.");
  if (!protectedActionId) throw new Error("Protected session did not invoke a Server Action.");
  console.log("Verified denied Server Action authorization.");

  const directActionResponse = await page.evaluate(async (actionId) => {
    const response = await fetch(window.location.href, {
      method: "POST",
      headers: {
        "Next-Action": actionId,
        "Content-Type": "text/plain;charset=UTF-8",
      },
      body: "[]",
      cache: "no-store",
    });
    const body = await response.text();
    return { status: response.status, includesSessionUrl: body.includes("test-session-token") };
  }, protectedActionId);
  if (directActionResponse.includesSessionUrl) {
    throw new Error("Direct invocation without captured authorization returned a session.");
  }
  if (upstreamSessionCount !== 1) {
    throw new Error("Direct action invocation bypassed host authorization.");
  }

  const tamperedPayload = tamperEncryptedCapture(protectedActionPayload);
  if (!tamperedPayload) {
    throw new Error(`Protected action request did not include a tamperable encrypted value: ${JSON.stringify(protectedActionRequestInfo)}`);
  }
  const tamperedActionResponse = await page.evaluate(async ({ actionId, body, contentType }) => {
    const response = await fetch(window.location.href, {
      method: "POST",
      headers: {
        "Next-Action": actionId,
        "Content-Type": contentType,
      },
      body,
      cache: "no-store",
    });
    const responseBody = await response.text();
    return { status: response.status, includesSessionUrl: responseBody.includes("test-session-token") };
  }, {
    actionId: protectedActionId,
    body: tamperedPayload,
    contentType: protectedActionRequestInfo.contentType,
  });
  if (tamperedActionResponse.includesSessionUrl) {
    throw new Error("Tampered action capture returned a session.");
  }
  if (upstreamSessionCount !== 1) {
    throw new Error("Tampered action capture reached Seha Care.");
  }
  console.log("Verified direct and tampered Server Action rejection.");

  const metadataSection = page.locator("#metadata-visitor");
  await metadataSection.scrollIntoViewIfNeeded();
  await metadataSection.getByRole("button", { name: "Start session" }).click();
  await metadataSection.getByRole("alert").waitFor();
  if (upstreamSessionCount !== 1) {
    throw new Error("An unauthorized Route Handler request created a session.");
  }

  const unauthorizedRouteResponse = await page.evaluate(async () => {
    const response = await fetch("/api/seha-care/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-organization-context": "clinic-12",
      },
      body: JSON.stringify({
        organizationContext: { bookingId: "booking-4821" },
        initAgent: "receptionist",
      }),
      cache: "no-store",
    });
    return response.status;
  });
  if (unauthorizedRouteResponse !== 401 || upstreamSessionCount !== 1) {
    throw new Error("A direct unauthorized Route Handler request reached Seha Care.");
  }
  console.log("Verified direct Route Handler authorization.");

  await page.context().addCookies([{
    name: "consultation_access",
    value: "allowed",
    url: `http://${host}:${appPort}`,
  }]);
  await protectedSection.getByRole("button", { name: "Start session" }).click();
  await protectedSection.getByTitle("Seha Care consultation").waitFor();
  if (upstreamSessionCount !== 2) throw new Error("Authorized submit did not create a session.");
  if (upstreamSessionBodies[1]?.language !== "ar") {
    throw new Error("The authorized Server Action did not forward Arabic language.");
  }

  const malformedRouteResponse = await page.evaluate(async () => {
    const response = await fetch("/api/seha-care/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-organization-context": "clinic-12",
      },
      body: JSON.stringify({
        organizationContext: { bookingId: "booking-4821" },
        initAgent: "not-a-supported-agent",
      }),
      cache: "no-store",
    });
    return response.status;
  });
  if (malformedRouteResponse !== 400 || upstreamSessionCount !== 2) {
    throw new Error("A malformed Route Handler request reached Seha Care.");
  }
  console.log("Verified malformed Route Handler rejection.");

  const invalidLanguageRouteResponse = await page.evaluate(async () => {
    const response = await fetch("/api/seha-care/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-organization-context": "clinic-12",
      },
      body: JSON.stringify({
        organizationContext: { bookingId: "booking-4821" },
        language: "EN",
      }),
      cache: "no-store",
    });
    return response.status;
  });
  if (invalidLanguageRouteResponse !== 400 || upstreamSessionCount !== 2) {
    throw new Error("An invalid session language reached Seha Care.");
  }

  await metadataSection.getByRole("button", { name: "Start session" }).click();
  await metadataSection.getByTitle("Seha Care consultation").waitFor();
  if (upstreamSessionCount !== 3) {
    throw new Error("The authorized metadata request did not create exactly one session.");
  }
  if (upstreamSessionBodies[2]?.language !== "en") {
    throw new Error("The authorized Route Handler did not forward English language.");
  }
  console.log("Verified authorized custom headers and JSON body.");

  await Promise.all(pendingResponseScans);
  if (leakedResponses.length > 0) throw new Error("Tenant key found in a browser response.");
  if (credentialRequests.length > 0) throw new Error("Browser request sent a tenant-key header.");

  console.log(`${developmentMode ? "Development" : "Production"} Next.js integration passed.`);
} finally {
  await browser?.close();
  app.kill();
  await new Promise((resolve) => upstream.close(resolve));
}

function tamperEncryptedCapture(payload) {
  if (!payload) return undefined;
  const encryptedValue = /[A-Za-z0-9+/=_-]{64,}/.exec(payload);
  if (!encryptedValue || encryptedValue.index === undefined) return undefined;
  const index = encryptedValue.index + Math.floor(encryptedValue[0].length / 2);
  const replacement = payload[index] === "A" ? "B" : "A";
  return `${payload.slice(0, index)}${replacement}${payload.slice(index + 1)}`;
}
