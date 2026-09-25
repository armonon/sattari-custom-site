import { defineConfig } from 'vitest/config';

// Pure export contracts need no React transform or DOM. Keep release checks
// lightweight enough to run alongside the real-browser audio fixtures.
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/utils/arrangementStreamExport.test.js',
      'src/utils/arrangementLongExport.test.js',
    ],
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 30000,
  },
});
