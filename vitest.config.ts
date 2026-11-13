import { defineConfig } from "vitest/config";

// Separate from vite.config.ts so the React Router plugin is not loaded in tests.
// Function tests live in extensions/alongside-discount and run there (npm test).
export default defineConfig({
  test: {
    include: ["app/**/*.test.ts"],
  },
});
