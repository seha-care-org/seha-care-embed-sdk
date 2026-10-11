import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EmbeddedSessionRequestError, SehaCareEmbedClient } from "../src/server/index.js";

const tenantKey = "synthetic-redirect-test-key";
const responseBody = "redirect response body must not appear in errors";
const redirectStatuses = [301, 302, 303, 307, 308] as const;
const destinationKinds = ["same-origin", "cross-origin"] as const;

let apiServer: Server;
let crossOriginServer: Server;
let apiOrigin: string;
let crossOrigin: string;
let redirectStatus: number;
let destinationKind: (typeof destinationKinds)[number];
let sameOriginFollowups = 0;
let crossOriginFollowups = 0;
let apiCalls = 0;

function listen(server: Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server: Server): Promise<void> {
  server.closeAllConnections();
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function redirectRequest(_request: IncomingMessage, response: ServerResponse) {
  apiCalls += 1;
  const location = destinationKind === "same-origin"
    ? `${apiOrigin}/redirect-target`
    : `${crossOrigin}/redirect-target`;
  response.writeHead(redirectStatus, { Location: location });
  response.end(responseBody);
}

describe("server client redirect handling", () => {
  beforeAll(async () => {
    apiServer = createServer((request, response) => {
      if (request.url === "/redirect-target") {
        sameOriginFollowups += 1;
        request.resume();
        response.writeHead(200).end("unexpected same-origin redirect follow-up");
        return;
      }
      redirectRequest(request, response);
    });
    crossOriginServer = createServer((request, response) => {
      crossOriginFollowups += 1;
      request.resume();
      response.writeHead(200).end("unexpected cross-origin redirect follow-up");
    });
    apiOrigin = await listen(apiServer);
    crossOrigin = await listen(crossOriginServer);
  });

  afterAll(async () => {
    await Promise.all([close(apiServer), close(crossOriginServer)]);
  });

  it.each(redirectStatuses.flatMap((status) =>
    destinationKinds.map((destination) => [status, destination] as const),
  ))("rejects HTTP %i redirects to %s without a follow-up request", async (status, destination) => {
    redirectStatus = status;
    destinationKind = destination;
    const callsBefore = apiCalls;
    const client = new SehaCareEmbedClient(tenantKey, { apiBaseUrl: apiOrigin });

    let caught: unknown;
    try {
      await client.startSession();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(EmbeddedSessionRequestError);
    expect(caught).toMatchObject({
      status,
      message: `Embedded session request failed with HTTP ${status}`,
    });
    const message = (caught as Error).message;
    expect(message).not.toContain(tenantKey);
    expect(message).not.toContain(responseBody);
    expect(message).not.toContain("redirect-target");
    expect(sameOriginFollowups).toBe(0);
    expect(crossOriginFollowups).toBe(0);
    expect(apiCalls).toBe(callsBefore + 1);
  });
});
