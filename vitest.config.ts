import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    setupFiles: ["./tests/setupEnv.ts"],
    include: ["tests/unit/**/*.test.ts"],
    // Several suites share one real Postgres test database (fixture
    // emails are fixed strings, not randomized), so run test files
    // sequentially to avoid unique-constraint races between them.
    fileParallelism: false,
  },
});
