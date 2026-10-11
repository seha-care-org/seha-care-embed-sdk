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
  },
});
