import {
  EmbeddedSessionRequestError,
  SehaCareEmbedClient,
  validateStartSessionOptions,
} from "@seha-care/embed-sdk/server";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const packageDist = resolve(directory, "../..", "dist");
const sdkDist = packageDist;

function send(response, status, body) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 8192) throw new RangeError("Request body is too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const sdkFiles = new Map([
  ["/sdk/client/index.js", resolve(sdkDist, "client", "index.js")],
  ["/sdk/shared/client-core.js", resolve(sdkDist, "shared", "client-core.js")],
  ["/sdk/shared/types.js", resolve(sdkDist, "shared", "types.js")],
]);

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", "http://localhost");

  if (request.method === "GET" && requestUrl.pathname === "/") {
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
    });
    response.end(await readFile(resolve(directory, "public/index.html")));
    return;
  }

  if (request.method === "GET" && sdkFiles.has(requestUrl.pathname)) {
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": extname(requestUrl.pathname) === ".js" ? "text/javascript; charset=utf-8" : "application/octet-stream",
    });
    response.end(await readFile(sdkFiles.get(requestUrl.pathname)));
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/seha-care/session") {
    let options;
    try {
      options = validateStartSessionOptions(await readJson(request));
    } catch {
      send(response, 400, { error: "Invalid session options" });
      return;
    }

    try {
      const client = new SehaCareEmbedClient(process.env.SEHA_TENANT_API_KEY ?? "", {
        apiBaseUrl: process.env.SEHA_API_BASE_URL,
      });
      const result = await client.startSession(options);
      send(response, 201, result);
    } catch (error) {
      const status = error instanceof EmbeddedSessionRequestError ? error.status ?? 502 : 502;
      send(response, status, { error: "Could not start the consultation" });
    }
    return;
  }

  response.writeHead(404, { "Cache-Control": "no-store" }).end();
});

const port = Number(process.env.PORT ?? "4177");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new TypeError("PORT must be a valid TCP port");
}
server.listen(port, "127.0.0.1");
