import {
  EmbeddedSessionRequestError,
  readSessionResponse,
} from "../shared/client-core.js";
import {
  EMBEDDED_SESSION_PATH,
  validateStartSessionOptions,
} from "../shared/types.js";
import type {
  StartEmbeddedSessionOptions,
  StartEmbeddedSessionResponse,
} from "../shared/types.js";

export function createEndpoint(apiBaseUrl: string): string {
  let base: URL;
  try {
    base = new URL(apiBaseUrl);
  } catch {
    throw new TypeError("apiBaseUrl must be an absolute HTTP or HTTPS origin");
  }

  if (
    (base.protocol !== "https:" && base.protocol !== "http:") ||
    base.username !== "" ||
    base.password !== "" ||
    (base.pathname !== "" && base.pathname !== "/") ||
    base.search !== "" ||
    base.hash !== ""
  ) {
    throw new TypeError("apiBaseUrl must be an absolute HTTP or HTTPS origin");
  }

  return new URL(EMBEDDED_SESSION_PATH, base.origin).toString();
}

export async function requestStartSession(
  endpoint: string,
  tenantApiKey: string,
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
    redirect: "manual",
    headers: {
      "content-type": "application/json",
      "x-tenant-api-key": tenantApiKey,
    },
    body: JSON.stringify(body),
    signal,
  });

  return readSessionResponse(response);
}

export { EmbeddedSessionRequestError };
