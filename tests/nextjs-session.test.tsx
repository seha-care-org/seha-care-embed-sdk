import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { executeStartEmbeddedSession } from "../src/nextjs/action.js";
import { EmbedSession } from "../src/nextjs/index.js";

describe("Next.js session integration", () => {
  const sessionUrl = "https://demo.seha-care.com/en/embed/session/test-next-session";
  const tenantKey = "synthetic-next-test-key";

  beforeEach(() => {
    vi.stubEnv("SEHA_TENANT_API_KEY", tenantKey);
    vi.stubEnv("SEHA_API_BASE_URL", "https://api.example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("creates a session only after submit, with the key in the server request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ sessionUrl }));
    vi.stubGlobal("fetch", fetchMock);
    render(<EmbedSession initAgent="knowledge" language="ar" />);
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Start session" }));
    await waitFor(() => expect(document.querySelector("iframe")).toHaveAttribute("src", sessionUrl));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, request] = fetchMock.mock.calls[0]!;
    expect(request.headers["x-tenant-api-key"]).toBe(tenantKey);
    expect(JSON.parse(request.body)).toEqual({ initAgent: "knowledge", language: "ar" });
  });

  it("authorizes each start with validated options before contacting the API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ sessionUrl }));
    vi.stubGlobal("fetch", fetchMock);
    const authorize = vi.fn(async (options) => {
      expect(options).toEqual({ initAgent: "triage" });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    await expect(executeStartEmbeddedSession(authorize, { initAgent: "triage" }))
      .resolves.toEqual({ sessionUrl });
    expect(authorize).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects denied authorization without a request or leaked error details", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const authorize = vi.fn().mockRejectedValue(new Error(tenantKey));
    await expect(executeStartEmbeddedSession(authorize, {}))
      .rejects.toThrow("Could not start the consultation. Please try again.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates untrusted options before authorization or a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const authorize = vi.fn();
    await expect(executeStartEmbeddedSession(authorize, { language: "EN" as "en" }))
      .rejects.toThrow("Could not start the consultation. Please try again.");
    expect(authorize).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a non-function authorization hook without a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(executeStartEmbeddedSession("invalid" as never, {}))
      .rejects.toThrow("Could not start the consultation. Please try again.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("routes endpoint mode through the browser without the server key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ sessionUrl }));
    vi.stubGlobal("fetch", fetchMock);
    render(<EmbedSession
      sessionEndpoint="/api/seha-care/session"
      sessionHeaders={{ "x-organization-context": "clinic-12" }}
      sessionBody={{ organizationContext: { bookingId: "test-booking" } }}
      language="en"
    />);
    fireEvent.click(screen.getByRole("button", { name: "Start session" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, request] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${window.location.origin}/api/seha-care/session`);
    expect(JSON.stringify(request)).not.toContain(tenantKey);
    expect(request.headers["x-organization-context"]).toBe("clinic-12");
    expect(JSON.parse(request.body)).toMatchObject({
      language: "en", organizationContext: { bookingId: "test-booking" },
    });
  });

  it("rejects metadata without an endpoint and endpoint mode with an authorization hook", () => {
    expect(() => EmbedSession({ sessionBody: {} } as never))
      .toThrow("custom session headers and body require sessionEndpoint");
    expect(() => EmbedSession({ sessionEndpoint: "/api/session", beforeStartAction: vi.fn() } as never))
      .toThrow("cannot be combined with beforeStartAction");
  });
});
