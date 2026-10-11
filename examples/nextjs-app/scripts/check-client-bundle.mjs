import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const directory = join(process.cwd(), ".next", "static");
const key = process.env.SEHA_TENANT_API_KEY;
const apiBaseUrl = process.env.SEHA_API_BASE_URL;

async function inspect(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) {
      await inspect(child);
    } else if (entry.name.endsWith(".js") || entry.name.endsWith(".map")) {
      const content = await readFile(child, "utf8");
      if (key && content.includes(key)) throw new Error("Tenant key found in a client asset.");
      if (apiBaseUrl && content.includes(apiBaseUrl)) throw new Error("Server API origin found in a client asset.");
      if (/SEHA_TENANT_API_KEY|x-tenant-api-key/.test(content)) {
        throw new Error("Server credential configuration found in a client asset.");
      }
    }
  }
}

await inspect(directory);
console.log("Next.js client assets contain no server credential configuration.");
