import {
  BadGatewayException,
  BadRequestException,
  Controller,
  Header,
  HttpException,
  HttpCode,
  Post,
  Body,
} from "@nestjs/common";
import {
  EmbeddedSessionRequestError,
  SehaCareEmbedClient,
  validateStartSessionOptions,
} from "@seha-care/embed-sdk/server";
import type { StartEmbeddedSessionRequest } from "@seha-care/embed-sdk/server";

@Controller("api/seha-care")
export class SessionController {
  @Post("session")
  @HttpCode(201)
  @Header("Cache-Control", "no-store")
  async startSession(@Body() body: unknown) {
    let options: StartEmbeddedSessionRequest;
    try {
      options = validateStartSessionOptions(body);
    } catch {
      throw new BadRequestException("Invalid session options");
    }

    try {
      const client = new SehaCareEmbedClient(
        process.env.SEHA_TENANT_API_KEY ?? "",
        { apiBaseUrl: process.env.SEHA_API_BASE_URL },
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
