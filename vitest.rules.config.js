// Dedicated Vitest config for Firestore rules tests.
// Runs against the Firestore Emulator (see `npm run test:rules` in package.json).
// Kept separate from the default config so that regular `npm test` runs
// without needing the emulator.
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['firestore.rules.test.ts'],
    exclude: ['node_modules', 'dist', 'functions/**', '.claude/**', '.worktrees/**'],
    testTimeout: 30000,
  },
});
