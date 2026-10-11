import { build } from "esbuild";
import { ngPackagr } from "ng-packagr";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const cjsOutput = resolve(repositoryRoot, "dist/server/index.cjs");

await build({
  entryPoints: [resolve(repositoryRoot, "dist/server/index.js")],
  outfile: cjsOutput,
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: true,
});

await import("./copy-react-assets.mjs");

await ngPackagr()
  .forProject(resolve(repositoryRoot, "src/angular/ng-package.json"))
  .build();
