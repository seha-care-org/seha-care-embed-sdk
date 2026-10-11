import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SehaCareEmbedClient } from "../src/client/index.js";

const redirectStatuses = [301, 302, 303, 307, 308] as const;

function listen(server: Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

async function close(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

describe("browser client redirect handling", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(redirectStatuses.flatMap((status) =>
    ["same-origin", "cross-origin"].map((destinationKind) => [status, destinationKind] as const),
  ))("rejects HTTP %i redirects to %s without forwarding request headers", async (status, destinationKind) => {
    let targetRequests = 0;
    let redirectRequests = 0;
    let targetReceivedCustomHeader = false;
    const targetServer = createServer((request, response) => {
      targetRequests++;
      targetReceivedCustomHeader ||= request.headers["x-organization-context"] !== undefined;
      request.resume();
      response.writeHead(200).end("unexpected redirect follow-up");
    });
    const targetOrigin = await listen(targetServer);
    const apiServer = createServer((request, response) => {
      if (request.url === "/redirect-target") {
        targetRequests++;
        targetReceivedCustomHeader ||= request.headers["x-organization-context"] !== undefined;
        request.resume();
        response.writeHead(200).end("unexpected same-origin redirect follow-up");
        return;
      }
      redirectRequests++;
      const destinationOrigin = destinationKind === "same-origin" ? apiOrigin : targetOrigin;
      response.writeHead(status, {
        Location: `${destinationOrigin}/redirect-target`,
      }).end("redirect body");
      request.resume();
    });
    const apiOrigin = await listen(apiServer);
    vi.stubGlobal("location", { origin: apiOrigin });

    try {
      const client = new SehaCareEmbedClient("/api/seha-care/session");
      await expect(client.startSession({
        headers: { "x-organization-context": "clinic-12" },
        body: { organizationContext: { bookingId: "booking-4821" } },
      })).rejects.toThrow();

      expect(redirectRequests).toBe(1);
      expect(targetRequests).toBe(0);
      expect(targetReceivedCustomHeader).toBe(false);
    } finally {
      await Promise.all([close(apiServer), close(targetServer)]);
    }
  });
});
