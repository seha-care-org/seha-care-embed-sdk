"use server";

import { cookies } from "next/headers";
import type { StartEmbeddedSessionRequest } from "@seha-care/embed-sdk/server";

/** Example host authorization. Production applications should check their own session and policy. */
export async function requireConsultationAccess(
  _options: StartEmbeddedSessionRequest,
): Promise<void> {
  const accessCookie = (await cookies()).get("consultation_access")?.value;
  if (accessCookie !== "allowed") {
    throw new Error("Consultation access is required");
  }
}
