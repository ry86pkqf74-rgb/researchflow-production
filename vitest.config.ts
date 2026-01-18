import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'packages/**/*.test.ts',
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/governance/**/*.test.ts',
    ],
    exclude: [
      'node_modules',
      '**/node_modules/**',
      'tests/e2e/**',
      'services/web/**',
      'tests/integration/api-endpoints.test.ts',
      'tests/integration/artifacts.test.ts',
      'tests/integration/standby-mode.test.ts',
    ],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@researchflow/core': fileURLToPath(new URL('./packages/core', import.meta.url)),
      '@researchflow/ai-router': fileURLToPath(new URL('./packages/ai-router', import.meta.url)),
      '@researchflow/phi-engine': fileURLToPath(new URL('./packages/phi-engine', import.meta.url)),
      '@packages/core': fileURLToPath(new URL('./packages/core', import.meta.url)),
      '@apps/api-node': fileURLToPath(new URL('./services/orchestrator', import.meta.url)),
      '@apps/api-node/src': fileURLToPath(new URL('./services/orchestrator/src', import.meta.url)),
    },
  },
});
