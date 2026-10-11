import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EmbeddedSessionRequestError,
  SehaCareEmbedClient,
} from "../src/server/index.js";

describe("SehaCareEmbedClient", () => {
  beforeEach(() => {
    vi.stubEnv("SEHA_API_BASE_URL", "https://api.example.com/");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("posts optional session settings using only the constructor API key", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ sessionUrl: "https://app.example.com/en/embed/session/token" }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new SehaCareEmbedClient("tenant-secret-test-value");

    await expect(
      client.startSession({
        userIdentity: "visitor-123",
        initAgent: "knowledge",
        initDialect: "EGY",
        language: "en",
      }),
    ).resolves.toEqual({
      sessionUrl: "https://app.example.com/en/embed/session/token",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/session/embed/start-session",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        redirect: "manual",
        headers: {
          "content-type": "application/json",
          "x-tenant-api-key": "tenant-secret-test-value",
        },
        body: JSON.stringify({
          userIdentity: "visitor-123",
          initAgent: "knowledge",
          initDialect: "EGY",
          language: "en",
        }),
      }),
    );
  });

  it("sends an empty object when no session options are supplied", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ sessionUrl: "https://app.example.com/en/embed/session/token" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new SehaCareEmbedClient("tenant-secret-test-value");

    await client.startSession();

    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe("{}");
  });

  it.each(["EN", "en-US", "", null])(
    "rejects invalid language %s before fetching",
    async (language) => {
      const fetchMock = vi.fn<typeof fetch>();
      vi.stubGlobal("fetch", fetchMock);
      const client = new SehaCareEmbedClient("tenant-secret-test-value");

      await expect(client.startSession({ language: language as never })).rejects.toThrow(
        "language must be en or ar",
      );
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("reports HTTP failures without exposing response content", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("tenant-secret-test-value must never appear", { status: 429 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new SehaCareEmbedClient("tenant-secret-test-value");

    await expect(client.startSession()).rejects.toMatchObject({
      name: "EmbeddedSessionRequestError",
      status: 429,
      message: "Embedded session request failed with HTTP 429",
    });
  });

  it("rejects malformed JSON and malformed session URLs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>()
        .mockResolvedValueOnce(new Response("not-json"))
        .mockResolvedValueOnce(Response.json({ sessionUrl: "javascript:alert(1)" })),
    );
    const malformedJsonClient = new SehaCareEmbedClient("tenant-secret-test-value");
    const invalidUrlClient = new SehaCareEmbedClient("tenant-secret-test-value");

    await expect(malformedJsonClient.startSession()).rejects.toBeInstanceOf(
      EmbeddedSessionRequestError,
    );
    await expect(invalidUrlClient.startSession()).rejects.toThrow("invalid session URL");
  });

  it("reads the API origin from server configuration and requires an API key", () => {
    vi.stubEnv("SEHA_API_BASE_URL", "https://api.example.com/api/v1");
    expect(() => new SehaCareEmbedClient("test")).toThrow(
      "absolute HTTP or HTTPS origin",
    );
    expect(() => new SehaCareEmbedClient(" ")).toThrow("apiKey must not be empty");

    vi.stubEnv("SEHA_API_BASE_URL", "");
    expect(() => new SehaCareEmbedClient("test")).toThrow(
      "SEHA_API_BASE_URL must be configured on the server",
    );
  });

  it("allows an explicit origin for framework configuration services", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({ sessionUrl: "https://app.example.com/en/embed/session/token" }),
      ),
    );
    const client = new SehaCareEmbedClient("tenant-secret-test-value", {
      apiBaseUrl: "https://override.example.com",
    });

    await client.startSession();

    expect(fetch).toHaveBeenCalledWith(
      "https://override.example.com/api/v1/session/embed/start-session",
      expect.anything(),
    );
  });
});
