import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  test: {
    server: {
      deps: {
        // Installed SDK entry points import CSS; let Vite transform them.
        inline: ["@seha-care/embed-sdk"],
      },
    },
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    restoreMocks: true,
    clearMocks: true,
  },
});
