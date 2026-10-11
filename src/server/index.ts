import process from "node:process";
import { createEndpoint, requestStartSession } from "./server-core.js";
import { EmbeddedSessionRequestError } from "../shared/client-core.js";
import type {
  StartEmbeddedSessionOptions,
  StartEmbeddedSessionResponse,
} from "../shared/types.js";

export { EmbeddedSessionRequestError } from "../shared/client-core.js";
export { validateStartSessionOptions } from "../shared/client-core.js";
export type {
  ArabicDialect,
  EmbeddedAgent,
  SessionLanguage,
  StartEmbeddedSessionOptions,
  StartEmbeddedSessionRequest,
  StartEmbeddedSessionResponse,
} from "../shared/types.js";

export interface SehaCareEmbedClientOptions {
  apiBaseUrl?: string;
}

/** Server-side client for creating Seha Care embedded sessions. */
export class SehaCareEmbedClient {
  private readonly endpoint: string;

  private readonly tenantApiKey: string;

  constructor(tenantApiKey: string, options: SehaCareEmbedClientOptions = {}) {
    if (!tenantApiKey.trim()) {
      throw new TypeError("apiKey must not be empty");
    }

    this.tenantApiKey = tenantApiKey;
    this.endpoint = createEndpoint(options.apiBaseUrl ?? readApiBaseUrl());
  }

  startSession(
    options: StartEmbeddedSessionOptions = {},
  ): Promise<StartEmbeddedSessionResponse> {
    return requestStartSession(this.endpoint, this.tenantApiKey, options);
  }
}

function readApiBaseUrl(): string {
  const apiBaseUrl = process.env.SEHA_API_BASE_URL;
  if (!apiBaseUrl?.trim()) {
    throw new TypeError("SEHA_API_BASE_URL must be configured on the server");
  }
  return apiBaseUrl;
}
