// functions/vitest.firestore.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/billing/**/*.test.ts"],
    exclude: [
      "src/billing/constants.test.ts",      // (no such file, but defensive)
      "src/billing/types.test.ts",
      "src/billing/currentMonthId.test.ts",  // pure function, no emulator
    ],
    testTimeout: 30000,
    pool: "forks",
  },
});
