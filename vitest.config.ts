import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __SEHA_API_BASE_URL__: JSON.stringify("https://api.example.com"),
  },
  test: {
    environment: "jsdom",
    restoreMocks: true,
    clearMocks: true,
    setupFiles: ["./tests/setup.ts"],
    exclude: ["examples/**", "**/node_modules/**", "**/dist/**", "**/coverage/**"],
  },
});
