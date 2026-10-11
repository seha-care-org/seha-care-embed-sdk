import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const exampleDirectory = process.cwd();
const buildDirectory = process.env.SEHA_NEXT_BUILD_DIR ?? (
  existsSync(join(exampleDirectory, ".next-sdk-integration"))
    ? ".next-sdk-integration"
    : ".next"
);
const directory = join(
  exampleDirectory,
  buildDirectory,
  "static",
);
const key = process.env.SEHA_TENANT_API_KEY;

async function inspect(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) {
      await inspect(child);
    } else if (entry.name.endsWith(".js") || entry.name.endsWith(".map")) {
      const content = await readFile(child, "utf8");
      if (key && content.includes(key)) throw new Error("Tenant key found in a client asset.");
      if (/SEHA_TENANT_API_KEY|x-tenant-api-key/.test(content)) {
        throw new Error("Server credential configuration found in a client asset.");
      }
    }
  }
}

await inspect(directory);
console.log("Next.js client assets contain no server credential configuration.");
