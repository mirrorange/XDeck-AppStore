import { defineConfig } from "vitest/config";

// Separate from vite.config.ts: the React Router plugin is not needed for tests.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["app/**/*.test.{ts,tsx}", "scripts/**/*.test.ts", "test/**/*.test.ts"],
    css: false,
  },
});
