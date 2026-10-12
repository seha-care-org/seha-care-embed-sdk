import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __SEHA_API_BASE_URL__: JSON.stringify("https://api.example.com"),
  },
  test: {
    environment: "jsdom",
    restoreMocks: true,
    clearMocks: true,
    fileParallelism: false,
    maxWorkers: 1,
    setupFiles: ["./tests/setup.ts", "./tests/angular-test-setup.ts"],
    exclude: ["examples/**", "**/node_modules/**", "**/dist/**", "**/coverage/**"],
    coverage: {
      provider: "v8",
      // Angular tests load the compiled package. Include its bundle so V8 can
      // map that coverage back to the Angular sources instead of reporting 0%.
      include: ["src/**/*.ts", "src/**/*.tsx", "dist/angular/fesm2022/*.mjs"],
      exclude: ["src/**/*.d.ts"],
      reporter: ["text", "html", "lcov", "json-summary"],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 75,
      },
    },
  },
});
