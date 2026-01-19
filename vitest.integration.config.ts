import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

/**
 * Integration test configuration
 * Focuses on integration tests that require service interaction
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/integration/**/*.test.ts',
    ],
    exclude: [
      'node_modules',
      '**/node_modules/**',
      // These require live services
      'tests/integration/api-endpoints.test.ts',
      'tests/integration/artifacts.test.ts',
      'tests/integration/standby-mode.test.ts',
      // Manuscript-engine integration tests require services
      'tests/integration/manuscript-engine/**/*.test.ts',
    ],
    testTimeout: 30000,
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
