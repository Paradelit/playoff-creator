// functions/vitest.firestore.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/billing/usage.test.ts"],
    testTimeout: 30000,
    pool: "forks", // emulator tests prefer process isolation
  },
});
