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
      // Manuscript-engine tests excluded - services need implementation
      'tests/integration/manuscript-engine/**/*.test.ts',
    ],
    testTimeout: 10000,
    // Phase A - Task 19: Coverage configuration with thresholds
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // Coverage thresholds - builds fail if below these values
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
      // Files to include in coverage
      include: [
        'packages/**/src/**/*.ts',
        'services/orchestrator/src/**/*.ts',
      ],
      // Files to exclude from coverage
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/*.d.ts',
        '**/types/**',
        '**/fixtures/**',
      ],
    },
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
