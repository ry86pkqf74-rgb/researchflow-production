import '@testing-library/jest-dom';
import { beforeAll } from 'vitest';

// Global test setup
beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';

  // Provide defaults for Replit auth in tests
  if (!process.env.REPL_ID) {
    process.env.REPL_ID = 'test-repl-id';
  }
  if (!process.env.SESSION_SECRET) {
    process.env.SESSION_SECRET = 'test-session-secret';
  }
  
  // Warn if DATABASE_URL is not set for integration tests
  if (!process.env.DATABASE_URL) {
    console.warn('⚠️  DATABASE_URL not set - integration tests requiring database will be skipped');
  }
});
