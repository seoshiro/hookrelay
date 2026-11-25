import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/tests/**/*.test.ts'],
    globalSetup: ['src/tests/integration/globalSetup.ts'],
    // integration files share one database; run files sequentially
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
