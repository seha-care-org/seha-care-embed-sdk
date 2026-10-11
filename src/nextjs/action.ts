"use server";

import "server-only";

import process from "node:process";
import { SehaCareEmbedClient } from "../server/index.js";
import { validateStartSessionOptions } from "../shared/types.js";
import type {
  StartEmbeddedSessionRequest,
  StartEmbeddedSessionResponse,
} from "../shared/types.js";

export type BeforeStartAction = (
  options: StartEmbeddedSessionRequest,
) => void | Promise<void>;

export async function startEmbeddedSessionAction(
  beforeStartAction: BeforeStartAction | undefined,
  untrustedOptions: StartEmbeddedSessionRequest,
): Promise<StartEmbeddedSessionResponse> {
  try {
    const options = validateStartSessionOptions(untrustedOptions);
    if (beforeStartAction !== undefined) {
      if (typeof beforeStartAction !== "function") {
        throw new TypeError("beforeStartAction must be a Server Action");
      }
      await beforeStartAction(options);
    }
    const client = new SehaCareEmbedClient(
      process.env.SEHA_TENANT_API_KEY ?? "",
    );
    return await client.startSession(options);
  } catch {
    throw new Error("Could not start the consultation. Please try again.");
  }
}
