/**
 * PHI Scanner Startup Health Check
 *
 * Validates that the PHI scanner is operational before accepting requests.
 * When PHI_SCAN_ENABLED=true, this ensures:
 * - PHI scanner dependencies are loaded
 * - Patterns are properly initialized
 * - Test scan runs successfully
 * - Blocks startup in production if scanner fails
 *
 * SEC-004: PHI Scanner Startup Validation
 */

import { config } from '../config/env';
import { scanForPhi, redactPhiInData } from './phi-protection';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'failed';
  timestamp: string;
  checks: {
    configEnabled: boolean;
    scannerLoaded: boolean;
    testScanPassed: boolean;
    testRedactionPassed: boolean;
  };
  errors: string[];
  warnings: string[];
}

/**
 * Test data for validating PHI scanner functionality
 */
const TEST_DATA = {
  // Should detect SSN pattern
  ssn: 'My SSN is 123-45-6789',

  // Should detect MRN pattern
  mrn: 'Patient MRN: 987654321',

  // Should detect phone pattern
  phone: 'Call me at (555) 123-4567',

  // Should detect email pattern
  email: 'Contact: john.doe@example.com',

  // Should NOT have high-confidence PHI
  clean: 'This is completely clean text with no sensitive data',
};

/**
 * Verify PHI scanner dependencies are loaded
 */
function verifyDependencies(): { success: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    // Test that scanForPhi function is available
    if (typeof scanForPhi !== 'function') {
      errors.push('scanForPhi function not available from phi-protection');
    }

    // Test that redactPhiInData function is available
    if (typeof redactPhiInData !== 'function') {
      errors.push('redactPhiInData function not available from phi-protection');
    }

    return {
      success: errors.length === 0,
      errors
    };
  } catch (error) {
    return {
      success: false,
      errors: [`Failed to verify dependencies: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}

/**
 * Run test scans on dummy data to verify scanner works
 */
function runTestScans(): { success: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Test 1: SSN detection
    const ssnResult = scanForPhi(TEST_DATA.ssn);
    if (!ssnResult.detected || ssnResult.identifiers.length === 0) {
      errors.push('Failed to detect SSN pattern in test data');
    } else {
      const ssnFound = ssnResult.identifiers.some(id => id.type.toUpperCase().includes('SSN'));
      if (!ssnFound) {
        warnings.push('SSN pattern detection may not be working properly');
      }
    }

    // Test 2: MRN detection
    const mrnResult = scanForPhi(TEST_DATA.mrn);
    if (!mrnResult.detected || mrnResult.identifiers.length === 0) {
      warnings.push('MRN pattern detection may be disabled or not working');
    }

    // Test 3: Phone detection
    const phoneResult = scanForPhi(TEST_DATA.phone);
    if (!phoneResult.detected || phoneResult.identifiers.length === 0) {
      warnings.push('Phone pattern detection may be disabled or not working');
    }

    // Test 4: Email detection
    const emailResult = scanForPhi(TEST_DATA.email);
    if (!emailResult.detected || phoneResult.identifiers.length === 0) {
      warnings.push('Email pattern detection may be disabled or not working');
    }

    // Test 5: Clean data should NOT have PHI
    const cleanResult = scanForPhi(TEST_DATA.clean);
    if (cleanResult.detected && cleanResult.riskLevel === 'CRITICAL') {
      errors.push('Scanner incorrectly flagged clean text as CRITICAL PHI');
    }

    return {
      success: errors.length === 0,
      errors,
      warnings
    };
  } catch (error) {
    return {
      success: false,
      errors: [`Test scan failed: ${error instanceof Error ? error.message : String(error)}`],
      warnings: []
    };
  }
}

/**
 * Test redaction functionality
 */
function runRedactionTests(): { success: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Test redaction
    const redacted = redactPhiInData(TEST_DATA.ssn);

    // Verify redaction occurred (should contain redaction marker)
    if (!redacted.includes('[') || !redacted.includes(']')) {
      warnings.push('Redaction may not be working - expected [REDACTED-*] markers');
    }

    // Verify original SSN is not in redacted text
    if (redacted.includes('123-45-6789')) {
      errors.push('Redaction failed - original SSN still visible in redacted text');
    }

    return {
      success: errors.length === 0,
      errors,
      warnings
    };
  } catch (error) {
    return {
      success: false,
      errors: [`Redaction test failed: ${error instanceof Error ? error.message : String(error)}`],
      warnings: []
    };
  }
}

/**
 * Execute the full health check sequence
 */
export async function performPhiScannerHealthCheck(): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      configEnabled: config.phiScanEnabled,
      scannerLoaded: false,
      testScanPassed: false,
      testRedactionPassed: false
    },
    errors: [],
    warnings: []
  };

  // Check 1: Verify configuration
  if (!config.phiScanEnabled) {
    console.log('[PHI Health Check] PHI_SCAN_ENABLED is false - skipping scanner validation');
    result.status = 'healthy';
    return result;
  }

  console.log('[PHI Health Check] Starting PHI scanner validation...');

  // Check 2: Verify dependencies
  const depCheck = verifyDependencies();
  result.checks.scannerLoaded = depCheck.success;
  if (!depCheck.success) {
    result.errors.push(...depCheck.errors);
    result.status = 'failed';
  } else {
    console.log('[PHI Health Check] ✓ Dependencies loaded');
  }

  // Check 3: Run test scans
  const scanTests = runTestScans();
  result.checks.testScanPassed = scanTests.success;
  if (!scanTests.success) {
    result.errors.push(...scanTests.errors);
    result.status = 'failed';
  } else {
    console.log('[PHI Health Check] ✓ Test scans passed');
  }
  if (scanTests.warnings.length > 0) {
    result.warnings.push(...scanTests.warnings);
    if (result.status === 'healthy') {
      result.status = 'degraded';
    }
  }

  // Check 4: Run redaction tests
  const redactTests = runRedactionTests();
  result.checks.testRedactionPassed = redactTests.success;
  if (!redactTests.success) {
    result.errors.push(...redactTests.errors);
    result.status = 'failed';
  } else {
    console.log('[PHI Health Check] ✓ Redaction tests passed');
  }
  if (redactTests.warnings.length > 0) {
    result.warnings.push(...redactTests.warnings);
    if (result.status === 'healthy') {
      result.status = 'degraded';
    }
  }

  return result;
}

/**
 * Log health check results with appropriate severity
 */
export function logHealthCheckResults(result: HealthCheckResult): void {
  const separator = '='.repeat(70);

  console.log('');
  console.log(separator);
  console.log('PHI SCANNER HEALTH CHECK RESULTS');
  console.log(separator);
  console.log(`Status:        ${result.status.toUpperCase()}`);
  console.log(`Timestamp:     ${result.timestamp}`);
  console.log(`Config:        PHI_SCAN_ENABLED=${result.checks.configEnabled}`);
  console.log('');
  console.log('Checks:');
  console.log(`  - Dependencies Loaded: ${result.checks.scannerLoaded ? '✓' : '✗'}`);
  console.log(`  - Test Scan Passed:    ${result.checks.testScanPassed ? '✓' : '✗'}`);
  console.log(`  - Redaction Passed:    ${result.checks.testRedactionPassed ? '✓' : '✗'}`);

  if (result.errors.length > 0) {
    console.log('');
    console.log('ERRORS:');
    result.errors.forEach(err => console.error(`  ✗ ${err}`));
  }

  if (result.warnings.length > 0) {
    console.log('');
    console.log('WARNINGS:');
    result.warnings.forEach(warn => console.warn(`  ⚠ ${warn}`));
  }

  console.log('');
  console.log(separator);
}

/**
 * Validate health check and block startup if necessary
 *
 * In production with PHI_SCAN_ENABLED=true:
 * - FAILED status blocks startup with clear error
 * - DEGRADED status logs warnings but allows startup
 *
 * In development:
 * - FAILED status logs error but allows startup
 */
export function validateHealthCheckForStartup(
  result: HealthCheckResult,
  isProduction: boolean
): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = isProduction || nodeEnv === 'production';

  if (result.status === 'healthy') {
    console.log('[PHI Health Check] ✓ All checks passed - PHI scanner is operational');
    return;
  }

  if (result.status === 'degraded') {
    console.warn('[PHI Health Check] ⚠ Scanner is operational but with warnings');
    if (result.warnings.length > 0) {
      console.warn('[PHI Health Check] Warnings:');
      result.warnings.forEach(warn => console.warn(`  - ${warn}`));
    }
    return;
  }

  // Status === 'failed'
  if (isProd && result.checks.configEnabled) {
    // In production with PHI_SCAN_ENABLED=true, block startup
    const errorMessage = [
      '[PHI Health Check] CRITICAL: PHI Scanner failed to initialize',
      `Node Environment: ${nodeEnv}`,
      `Configuration: PHI_SCAN_ENABLED=${result.checks.configEnabled}`,
      'Errors:',
      ...result.errors.map(err => `  - ${err}`),
      '',
      'ACTION REQUIRED:',
      'The PHI scanner must be operational when PHI_SCAN_ENABLED=true in production.',
      'Please check the errors above and fix before starting the server.'
    ].join('\n');

    console.error(errorMessage);
    throw new Error('[PHI Health Check] PHI Scanner initialization failed - startup blocked');
  }

  // Development or PHI_SCAN_ENABLED=false
  console.error('[PHI Health Check] PHI Scanner initialization failed:');
  result.errors.forEach(err => console.error(`  - ${err}`));
  console.warn('[PHI Health Check] ⚠ Starting anyway in non-production environment');
}
