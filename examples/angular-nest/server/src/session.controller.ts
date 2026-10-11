import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  Header,
  HttpCode,
  HttpException,
  Post,
} from "@nestjs/common";
import type { StartEmbeddedSessionRequest } from "@seha-care/embed-sdk/server";
import {
  EmbeddedSessionRequestError,
  SehaCareEmbedClient,
  validateStartSessionOptions,
} from "@seha-care/embed-sdk/server";

@Controller("api/seha-care")
export class SessionController {
  @Post("session")
  @HttpCode(201)
  @Header("Cache-Control", "no-store")
  async startSession(@Body() body: unknown) {
    let options: StartEmbeddedSessionRequest;
    try {
      options = validateSessionRequest(body);
    } catch {
      throw new BadRequestException("Invalid session options");
    }

    try {
      const client = new SehaCareEmbedClient(
        process.env.SEHA_TENANT_API_KEY ?? ""
      );
      return await client.startSession(options);
    } catch (error) {
      if (error instanceof EmbeddedSessionRequestError && error.status) {
        throw new HttpException("Could not start the consultation", error.status);
      }
      throw new BadGatewayException("Could not start the consultation");
    }
  }
}

function validateSessionRequest(value: unknown): StartEmbeddedSessionRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Session request must be an object");
  }
  const { userIdentity, initAgent, initDialect, language } = value as Record<string, unknown>;
  return validateStartSessionOptions({ userIdentity, initAgent, initDialect, language });
}
