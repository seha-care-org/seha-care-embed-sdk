import "dotenv/config";

import {
  EmbeddedSessionRequestError,
  SehaCareEmbedClient,
  validateStartSessionOptions,
} from "@seha-care/embed-sdk/server";
import express, { type ErrorRequestHandler } from "express";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "8kb" }));

app.post("/api/seha-care/session", async (request, response) => {
  response.setHeader("Cache-Control", "no-store");

  let options: ReturnType<typeof validateStartSessionOptions>;
  try {
    options = validateStartSessionOptions(request.body);
  } catch {
    response.status(400).json({ error: "Invalid session options" });
    return;
  }

  try {
    const client = new SehaCareEmbedClient(
      process.env.SEHA_TENANT_API_KEY ?? "",
      { apiBaseUrl: process.env.SEHA_API_BASE_URL },
    );
    response.status(201).json(await client.startSession(options));
  } catch (error) {
    const status =
      error instanceof EmbeddedSessionRequestError
        ? error.status ?? 502
        : 502;
    response.status(status).json({ error: "Could not start the consultation" });
  }
});

const safeJsonErrors: ErrorRequestHandler = (_error, _request, response, _next) => {
  response.status(400).json({ error: "Invalid request" });
};
app.use(safeJsonErrors);

const port = Number(process.env.PORT ?? "4174");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new TypeError("PORT must be a valid TCP port");
}

app.listen(port, "127.0.0.1");
