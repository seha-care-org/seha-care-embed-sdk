import {
  DEFAULT_SESSION_ENDPOINT,
  validateStartSessionOptions,
  type StartEmbeddedSessionOptions,
  type StartEmbeddedSessionResponse,
} from "./types.js";

export { DEFAULT_SESSION_ENDPOINT, validateStartSessionOptions } from "./types.js";

export class EmbeddedSessionRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "EmbeddedSessionRequestError";
  }
}

export async function requestBrowserSession(
  endpoint: string,
  options: StartEmbeddedSessionOptions = {},
): Promise<StartEmbeddedSessionResponse> {
  if (typeof globalThis.fetch !== "function") {
    throw new TypeError("A fetch implementation is required");
  }

  const { signal, ...requestOptions } = options;
  const body = validateStartSessionOptions(requestOptions);
  const response = await globalThis.fetch(endpoint, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  return readSessionResponse(response);
}

export async function readSessionResponse(
  response: Response,
): Promise<StartEmbeddedSessionResponse> {
  if (!response.ok) {
    throw new EmbeddedSessionRequestError(
      `Embedded session request failed with HTTP ${response.status}`,
      response.status,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new EmbeddedSessionRequestError(
      "Embedded session response was not valid JSON",
      response.status,
    );
  }

  return { sessionUrl: readSessionUrl(payload) };
}

export function createBrowserEndpoint(endpoint: string): string {
  if (typeof endpoint !== "string" || !endpoint.trim()) {
    throw new TypeError("sessionEndpoint must be a non-empty URL");
  }
  if (typeof globalThis.location === "undefined") {
    throw new TypeError("The browser client requires a browser location");
  }

  let url: URL;
  try {
    url = new URL(endpoint, globalThis.location.origin);
  } catch {
    throw new TypeError("sessionEndpoint must be a same-origin HTTP or HTTPS URL");
  }

  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username !== "" ||
    url.password !== "" ||
    url.origin !== globalThis.location.origin
  ) {
    throw new TypeError("sessionEndpoint must be a same-origin HTTP or HTTPS URL");
  }

  return url.toString();
}

export function readSessionUrl(payload: unknown): string {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("sessionUrl" in payload) ||
    typeof payload.sessionUrl !== "string" ||
    payload.sessionUrl.length === 0
  ) {
    throw new EmbeddedSessionRequestError(
      "Embedded session response did not include a session URL",
    );
  }

  let url: URL;
  try {
    url = new URL(payload.sessionUrl);
  } catch {
    throw new EmbeddedSessionRequestError(
      "Embedded session response included an invalid session URL",
    );
  }

  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username !== "" ||
    url.password !== ""
  ) {
    throw new EmbeddedSessionRequestError(
      "Embedded session response included an invalid session URL",
    );
  }

  return payload.sessionUrl;
}
