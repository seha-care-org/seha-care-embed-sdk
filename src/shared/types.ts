export const EMBEDDED_SESSION_PATH = "/api/v1/session/embed/start-session";
export const DEFAULT_SESSION_ENDPOINT = "/api/seha-care/session";

export type EmbeddedAgent = "receptionist" | "triage" | "knowledge";

export type ArabicDialect = "MAGHREB" | "LEV" | "MSA" | "GLF" | "EGY";

export interface StartEmbeddedSessionOptions {
  userIdentity?: string;
  initAgent?: EmbeddedAgent;
  initDialect?: ArabicDialect;
  signal?: AbortSignal;
}

/** Options for a browser request to the host application's session endpoint. */
export interface BrowserStartEmbeddedSessionOptions extends StartEmbeddedSessionOptions {
  /** Additional headers sent only to the host application's endpoint. */
  headers?: Record<string, string>;
  /** Additional JSON fields sent only to the host application's endpoint. */
  body?: Record<string, unknown>;
}

export interface StartEmbeddedSessionResponse {
  sessionUrl: string;
}

export type StartEmbeddedSessionRequest = Omit<StartEmbeddedSessionOptions, "signal">;
export type BrowserSessionRequestBody = StartEmbeddedSessionRequest & Record<string, unknown>;

export interface ValidatedBrowserSessionRequest {
  headers: Record<string, string>;
  body: BrowserSessionRequestBody;
  signal?: AbortSignal;
}

const SESSION_OPTION_KEYS = ["userIdentity", "initAgent", "initDialect"] as const;

/** Validate browser-only metadata and combine it with the validated session options. */
export function validateBrowserSessionRequest(
  value: unknown,
): ValidatedBrowserSessionRequest {
  if (value === undefined) value = {};
  if (!isRecord(value)) throw new TypeError("Session options must be an object");

  const allowedKeys = new Set([...SESSION_OPTION_KEYS, "headers", "body", "signal"]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) throw new TypeError(`Unknown session option: ${key}`);
  }

  const sessionOptions = validateStartSessionOptions(
    Object.fromEntries(SESSION_OPTION_KEYS.flatMap((key) =>
      value[key] === undefined ? [] : [[key, value[key]]],
    )),
  );
  const customBody = serializeCustomBody(value.body);
  const customHeaders = validateCustomHeaders(value.headers);

  return {
    headers: customHeaders,
    body: { ...customBody, ...sessionOptions },
    ...(value.signal !== undefined ? { signal: validateSignal(value.signal) } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function serializeCustomBody(value: unknown): Record<string, unknown> {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new TypeError("Session body must be a JSON object");

  let parsed: unknown;
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new TypeError();
    parsed = JSON.parse(serialized);
  } catch {
    throw new TypeError("Session body must be JSON-serializable");
  }
  if (!isRecord(parsed)) throw new TypeError("Session body must serialize to a JSON object");

  const result = { ...parsed };
  for (const key of SESSION_OPTION_KEYS) delete result[key];
  return result;
}

function validateCustomHeaders(value: unknown): Record<string, string> {
  if (value === undefined) return { "content-type": "application/json" };
  if (!isRecord(value)) throw new TypeError("Session headers must be an object");

  const headers = new Headers();
  for (const [name, headerValue] of Object.entries(value)) {
    if (typeof headerValue !== "string") {
      throw new TypeError("Session header values must be strings");
    }
    headers.set(name, headerValue);
  }
  headers.set("content-type", "application/json");
  return Object.fromEntries(headers.entries());
}

function validateSignal(value: unknown): AbortSignal {
  if (
    typeof value !== "object" ||
    value === null ||
    typeof (value as AbortSignal).aborted !== "boolean" ||
    typeof (value as AbortSignal).addEventListener !== "function"
  ) {
    throw new TypeError("signal must be an AbortSignal");
  }
  return value as AbortSignal;
}

export function validateStartSessionOptions(value: unknown): StartEmbeddedSessionRequest {
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Session options must be an object");
  }

  const options = value as Record<string, unknown>;
  const allowedKeys = new Set(["userIdentity", "initAgent", "initDialect"]);
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

  return {
    ...(options.userIdentity !== undefined ? { userIdentity: options.userIdentity } : {}),
    ...(options.initAgent !== undefined ? { initAgent: options.initAgent } : {}),
    ...(options.initDialect !== undefined ? { initDialect: options.initDialect } : {}),
  } as StartEmbeddedSessionRequest;
}
