import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: [
      'src/billing/usage.test.ts', // emulator test, run via `npm run test:firestore`
      'src/billing/quota.test.ts', // future Task 4 emulator test
    ],
    globals: false,
    testTimeout: 10000,
  },
});
