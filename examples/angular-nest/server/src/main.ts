import "dotenv/config";
import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const port = Number(process.env.PORT ?? "4175");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new TypeError("PORT must be a valid TCP port");
  }
  const app = await NestFactory.create(AppModule, { logger: ["error", "warn"] });
  await app.listen(port, "127.0.0.1");
  console.log(`NestJS server is running at http://127.0.0.1:${port}`);
}

void bootstrap();
