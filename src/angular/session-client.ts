export const DEFAULT_SESSION_ENDPOINT = "/api/seha-care/session";

export type EmbeddedAgent = "receptionist" | "triage" | "knowledge";
export type ArabicDialect = "MAGHREB" | "LEV" | "MSA" | "GLF" | "EGY";
export type SessionLanguage = "en" | "ar";

export interface StartEmbeddedSessionOptions {
  userIdentity?: string;
  initAgent?: EmbeddedAgent;
  initDialect?: ArabicDialect;
  language?: SessionLanguage;
  signal?: AbortSignal;
}

export interface BrowserStartEmbeddedSessionOptions extends StartEmbeddedSessionOptions {
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
}

export interface StartEmbeddedSessionRequest {
  userIdentity?: string;
  initAgent?: EmbeddedAgent;
  initDialect?: ArabicDialect;
  language?: SessionLanguage;
}

export interface StartEmbeddedSessionResponse {
  sessionUrl: string;
}

export class EmbeddedSessionRequestError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "EmbeddedSessionRequestError";
  }
}

export function validateStartSessionOptions(value: unknown): StartEmbeddedSessionRequest {
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Session options must be an object");
  }

  const options = value as Record<string, unknown>;
  const allowedKeys = new Set(["userIdentity", "initAgent", "initDialect", "language"]);
  for (const key of Object.keys(options)) {
    if (!allowedKeys.has(key)) throw new TypeError(`Unknown session option: ${key}`);
  }
  if (options.userIdentity !== undefined && typeof options.userIdentity !== "string") {
    throw new TypeError("userIdentity must be a string");
  }
  if (
    options.initAgent !== undefined &&
    options.initAgent !== "receptionist" &&
    options.initAgent !== "triage" &&
    options.initAgent !== "knowledge"
  ) {
    throw new TypeError("initAgent is not supported");
  }
  if (
    options.initDialect !== undefined &&
    options.initDialect !== "MAGHREB" &&
    options.initDialect !== "LEV" &&
    options.initDialect !== "MSA" &&
    options.initDialect !== "GLF" &&
    options.initDialect !== "EGY"
  ) {
    throw new TypeError("initDialect is not supported");
  }
  if (options.language !== undefined && options.language !== "en" && options.language !== "ar") {
    throw new TypeError("language must be en or ar");
  }

  return {
    ...(options.userIdentity !== undefined ? { userIdentity: options.userIdentity } : {}),
    ...(options.initAgent !== undefined ? { initAgent: options.initAgent } : {}),
    ...(options.initDialect !== undefined ? { initDialect: options.initDialect } : {}),
    ...(options.language !== undefined ? { language: options.language } : {}),
  } as StartEmbeddedSessionRequest;
}

export function createSameOriginEndpoint(value: string, origin: string): string {
  let url: URL;
  try {
    url = new URL(value, origin);
  } catch {
    throw new TypeError("sessionEndpoint must be a same-origin HTTP or HTTPS URL");
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username !== "" ||
    url.password !== "" ||
    url.origin !== origin
  ) {
    throw new TypeError("sessionEndpoint must be a same-origin HTTP or HTTPS URL");
  }
  return url.toString();
}

export async function requestBrowserSession(
  endpoint: string,
  options: BrowserStartEmbeddedSessionOptions = {},
): Promise<StartEmbeddedSessionResponse> {
  const { signal, headers, body } = validateBrowserSessionRequest(options);
  const response = await fetch(endpoint, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    redirect: "error",
    headers,
    body: JSON.stringify(body),
    signal,
  });
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

  let sessionUrl: URL;
  try {
    sessionUrl = new URL(payload.sessionUrl);
  } catch {
    throw new EmbeddedSessionRequestError(
      "Embedded session response included an invalid session URL",
    );
  }
  if (
    (sessionUrl.protocol !== "http:" && sessionUrl.protocol !== "https:") ||
    sessionUrl.username !== "" ||
    sessionUrl.password !== ""
  ) {
    throw new EmbeddedSessionRequestError(
      "Embedded session response included an invalid session URL",
    );
  }

  return { sessionUrl: payload.sessionUrl };
}

function validateBrowserSessionRequest(value: unknown): {
  headers: Record<string, string>;
  body: StartEmbeddedSessionRequest & Record<string, unknown>;
  signal?: AbortSignal;
} {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Session options must be an object");
  }
  const options = value as Record<string, unknown>;
  const optionKeys = ["userIdentity", "initAgent", "initDialect", "language"] as const;
  const allowedKeys = new Set([...optionKeys, "headers", "body", "signal"]);
  for (const key of Object.keys(options)) {
    if (!allowedKeys.has(key)) throw new TypeError(`Unknown session option: ${key}`);
  }
  const sessionOptions = validateStartSessionOptions(
    Object.fromEntries(optionKeys.flatMap((key) =>
      options[key] === undefined ? [] : [[key, options[key]]],
    )),
  );

  let customBody: Record<string, unknown> = {};
  if (options.body !== undefined) {
    if (typeof options.body !== "object" || options.body === null || Array.isArray(options.body)) {
      throw new TypeError("Session body must be a JSON object");
    }
    try {
      const serialized = JSON.stringify(options.body);
      if (serialized === undefined) throw new TypeError();
      const parsed: unknown = JSON.parse(serialized);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new TypeError();
      }
      customBody = { ...(parsed as Record<string, unknown>) };
    } catch {
      throw new TypeError("Session body must be JSON-serializable");
    }
  }
  for (const key of optionKeys) delete customBody[key];

  const customHeaders = options.headers;
  if (customHeaders !== undefined &&
    (typeof customHeaders !== "object" || customHeaders === null || Array.isArray(customHeaders))) {
    throw new TypeError("Session headers must be an object");
  }
  const headers = new Headers();
  for (const [name, headerValue] of Object.entries(customHeaders ?? {})) {
    if (typeof headerValue !== "string") {
      throw new TypeError("Session header values must be strings");
    }
    headers.set(name, headerValue);
  }
  headers.set("content-type", "application/json");
  const normalizedHeaders: Record<string, string> = {};
  headers.forEach((headerValue, name) => { normalizedHeaders[name] = headerValue; });

  const signal = options.signal;
  if (signal !== undefined &&
    (typeof signal !== "object" || signal === null ||
      typeof (signal as AbortSignal).aborted !== "boolean" ||
      typeof (signal as AbortSignal).addEventListener !== "function")) {
    throw new TypeError("signal must be an AbortSignal");
  }

  return {
    headers: normalizedHeaders,
    body: { ...customBody, ...sessionOptions },
    ...(signal !== undefined ? { signal: signal as AbortSignal } : {}),
  };
}
