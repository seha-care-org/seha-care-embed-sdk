import {
  createBrowserEndpoint,
  DEFAULT_SESSION_ENDPOINT,
  requestBrowserSession,
} from "../shared/client-core.js";
import type {
  BrowserStartEmbeddedSessionOptions,
  StartEmbeddedSessionResponse,
} from "../shared/types.js";

export { EmbeddedSessionRequestError } from "../shared/client-core.js";
export type {
  ArabicDialect,
  BrowserStartEmbeddedSessionOptions,
  EmbeddedAgent,
  SessionLanguage,
  StartEmbeddedSessionOptions,
  StartEmbeddedSessionRequest,
  StartEmbeddedSessionResponse,
} from "../shared/types.js";

/** Browser client for a same-origin session endpoint hosted by the application. */
export class SehaCareEmbedClient {
  private readonly endpoint: string;

  constructor(sessionEndpoint = DEFAULT_SESSION_ENDPOINT) {
    this.endpoint = createBrowserEndpoint(sessionEndpoint);
  }

  startSession(
    options: BrowserStartEmbeddedSessionOptions = {},
  ): Promise<StartEmbeddedSessionResponse> {
    return requestBrowserSession(this.endpoint, options);
  }
}
