import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const outputDirectory = join(process.cwd(), "dist", "assets");
const assetNames = await readdir(outputDirectory, { withFileTypes: true });
const clientAssets = assetNames
  .filter((entry) => entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".map")))
  .map((entry) => entry.name);

for (const file of [join(process.cwd(), "dist", "index.html"), ...clientAssets.map((name) => join(outputDirectory, name))]) {
  const asset = await readFile(file, "utf8");
  if (/SEHA_TENANT_API_KEY|x-tenant-api-key/.test(asset)) {
    throw new Error("Server-side Seha Care configuration was found in a browser asset.");
  }
}

console.log("Browser assets use the session proxy without embedding server credentials.");
