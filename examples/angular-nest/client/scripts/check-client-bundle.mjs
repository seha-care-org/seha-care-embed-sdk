import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const browserDirectory = join(process.cwd(), "dist", "example", "browser");
const tenantKey = process.env.SEHA_TENANT_API_KEY;
const apiBaseUrl = process.env.SEHA_API_BASE_URL;

for (const entry of await readdir(browserDirectory, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  if (!entry.name.endsWith(".js") && !entry.name.endsWith(".map") && !entry.name.endsWith(".html")) continue;
  const content = await readFile(join(browserDirectory, entry.name), "utf8");
  if (tenantKey && content.includes(tenantKey)) throw new Error("Tenant key found in an Angular browser asset.");
  if (apiBaseUrl && content.includes(apiBaseUrl)) throw new Error("Server API origin found in an Angular browser asset.");
  if (/SEHA_TENANT_API_KEY|x-tenant-api-key|SEHA_API_BASE_URL/.test(content)) {
    throw new Error("Server credential configuration found in an Angular browser asset.");
  }
}

console.log("Angular browser assets contain no server credential configuration.");
