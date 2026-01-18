/**
 * E2E Test Fixtures Index
 *
 * Central export point for all E2E test fixtures.
 */

// User fixtures
export {
  E2E_USERS,
  ALL_ROLES,
  ROLE_HIERARCHY,
  hasPermission,
  type E2EUser,
  type Role,
} from './users.fixture';

// Authentication fixtures
export {
  loginAs,
  loginAsRole,
  logout,
  setMode,
  test,
  expect,
} from './auth.fixture';

// PHI data fixtures
export {
  MOCK_PHI,
  ALL_MOCK_PHI,
  CRITICAL_PHI,
  createMockScanResult,
  type PhiItem,
  type PhiType,
  type PhiStatus,
  type PhiScanResult,
} from './phi-data.fixture';
