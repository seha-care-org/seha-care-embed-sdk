import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const exampleDirectory = fileURLToPath(new URL("..", import.meta.url));
const nextExecutable = fileURLToPath(
  new URL("../node_modules/next/dist/bin/next", import.meta.url),
);
const build = spawn(process.execPath, [nextExecutable, "build", "--webpack"], {
  cwd: exampleDirectory,
  env: {
    ...process.env,
    SEHA_NEXT_BUILD_DIR: ".next-sdk-integration",
  },
  stdio: "inherit",
  windowsHide: true,
});

const [code, signal] = await new Promise((resolve, reject) => {
  build.once("error", reject);
  build.once("exit", (exitCode, exitSignal) => resolve([exitCode, exitSignal]));
});

if (code !== 0) {
  throw new Error(`Next.js integration build failed${signal ? ` (${signal})` : ""}.`);
}
