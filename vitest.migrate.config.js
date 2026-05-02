// Dedicated Vitest config for migration script tests.
// Runs against the Firestore Emulator (see `npm run test:migrate` in package.json).
// Kept separate from the default config so that regular `npm test` runs
// without needing the emulator. Mirrors `vitest.rules.config.js`.
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['scripts/migration/__tests__/**/*.test.js'],
    exclude: ['node_modules', 'dist', 'functions/**', '.claude/**', '.worktrees/**'],
    testTimeout: 30000,
  },
});
