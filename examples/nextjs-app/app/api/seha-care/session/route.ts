import { cookies } from "next/headers";
import {
  SehaCareEmbedClient,
  validateStartSessionOptions,
} from "@seha-care/embed-sdk/server";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  const accessCookie = (await cookies()).get("consultation_access")?.value;
  if (accessCookie !== "allowed") {
    return Response.json(
      { error: "Could not start the consultation" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid session request" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!isRecord(body)) {
    return Response.json(
      { error: "Invalid session request" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const organizationContext = body.organizationContext;
  if (
    request.headers.get("x-organization-context") !== "clinic-12" ||
    !isRecord(organizationContext) ||
    typeof organizationContext.bookingId !== "string"
  ) {
    return Response.json(
      { error: "Invalid session request" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  let options: ReturnType<typeof validateStartSessionOptions>;
  try {
    options = validateStartSessionOptions({
      userIdentity: body.userIdentity,
      initAgent: body.initAgent,
      initDialect: body.initDialect,
      language: body.language,
    });
  } catch {
    return Response.json(
      { error: "Invalid session options" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const client = new SehaCareEmbedClient(
      process.env.SEHA_TENANT_API_KEY ?? "",
    );
    const result = await client.startSession(options);
    return Response.json(result, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Could not start the consultation" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
