import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EmbeddedSessionRequestError,
  SehaCareEmbedClient,
} from "../src/client/index.js";

describe("browser SehaCareEmbedClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses a same-origin endpoint and never sends a tenant key", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ sessionUrl: "https://app.example.com/en/embed/session/token" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new SehaCareEmbedClient();

    await expect(
      client.startSession({ userIdentity: "visitor", initAgent: "triage" }),
    ).resolves.toEqual({
      sessionUrl: "https://app.example.com/en/embed/session/token",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/seha-care/session",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userIdentity: "visitor", initAgent: "triage" }),
      }),
    );
    expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty("x-tenant-api-key");
  });

  it("rejects HTTP errors without exposing response content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response("sensitive backend response", { status: 401 }),
      ),
    );

    await expect(new SehaCareEmbedClient().startSession()).rejects.toMatchObject({
      name: "EmbeddedSessionRequestError",
      status: 401,
      message: "Embedded session request failed with HTTP 401",
    });
  });

  it("rejects a cross-origin endpoint", () => {
    expect(() => new SehaCareEmbedClient("https://other.example.com/session")).toThrow(
      "same-origin HTTP or HTTPS URL",
    );
  });

  it("accepts an explicit same-origin endpoint", () => {
    const client = new SehaCareEmbedClient("http://localhost:3000/custom/session");
    expect(client).toBeInstanceOf(SehaCareEmbedClient);
  });

  it("rejects malformed session response payloads", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(Response.json({})));

    await expect(new SehaCareEmbedClient().startSession()).rejects.toBeInstanceOf(
      EmbeddedSessionRequestError,
    );
  });
});
