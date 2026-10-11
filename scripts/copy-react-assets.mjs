import { copyFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../src/react/embed-session.css", import.meta.url));
const destination = fileURLToPath(new URL("../dist/react/embed-session.css", import.meta.url));

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
