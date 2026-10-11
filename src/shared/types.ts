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

export interface StartEmbeddedSessionResponse {
  sessionUrl: string;
}

export type StartEmbeddedSessionRequest = Omit<StartEmbeddedSessionOptions, "signal">;

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
