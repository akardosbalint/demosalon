import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    testTimeout: 15_000,
    hookTimeout: 15_000,
    // All integration tests share one real Postgres database and reset it
    // between tests, so different test files must not run concurrently.
    fileParallelism: false,
  },
});
