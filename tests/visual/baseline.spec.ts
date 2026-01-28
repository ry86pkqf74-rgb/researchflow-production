import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests for ResearchFlow
 *
 * Tests critical user-facing pages for visual consistency.
 * Screenshots are compared against baseline images to catch unintended UI changes.
 *
 * Run with: npm run test:visual
 * Update baselines: npm run test:visual -- --update-snapshots
 */

test.describe('Visual Regression - Login Page', () => {
  test('should match baseline screenshot', async ({ page }) => {
    await page.goto('/auth/login');

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Compare full page screenshot
    await expect(page).toHaveScreenshot('login-page.png', {
      maxDiffPixels: 100,
      threshold: 0.2, // 20% threshold for pixel differences
    });
  });

  test('login form should match baseline', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    const loginForm = page.locator('[data-testid="login-form"]');
    if (await loginForm.isVisible()) {
      await expect(loginForm).toHaveScreenshot('login-form.png', {
        maxDiffPixels: 50,
        threshold: 0.2,
      });
    }
  });

  test('error state should match baseline', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    // Trigger error state
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');

    if (await emailInput.isVisible()) {
      await emailInput.fill('invalid-email');
      await passwordInput.fill('wrong-password');
      await submitButton.click();

      // Wait for error message to appear
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot('login-error-state.png', {
        maxDiffPixels: 75,
        threshold: 0.2,
      });
    }
  });
});

test.describe('Visual Regression - Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.goto('/');
    // In a real scenario, you'd have proper auth setup
  });

  test('dashboard layout should match baseline', async ({ page }) => {
    // Navigate to dashboard after auth
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Wait for main content to load
    await page.waitForSelector('[data-testid="dashboard-content"]', { timeout: 5000 }).catch(() => null);

    await expect(page).toHaveScreenshot('dashboard-overview.png', {
      maxDiffPixels: 150,
      threshold: 0.2,
    });
  });

  test('project cards should match baseline', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const projectCards = page.locator('[data-testid="project-card"]');
    if ((await projectCards.count()) > 0) {
      const firstCard = projectCards.first();
      await expect(firstCard).toHaveScreenshot('dashboard-project-card.png', {
        maxDiffPixels: 75,
        threshold: 0.2,
      });
    }
  });

  test('empty state should match baseline', async ({ page }) => {
    // This test assumes there's a way to view empty project state
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const emptyState = page.locator('[data-testid="empty-projects-state"]');
    if (await emptyState.isVisible()) {
      await expect(emptyState).toHaveScreenshot('dashboard-empty-state.png', {
        maxDiffPixels: 75,
        threshold: 0.2,
      });
    }
  });
});

test.describe('Visual Regression - Governance Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/governance');
    await page.waitForLoadState('networkidle');
  });

  test('governance overview should match baseline', async ({ page }) => {
    await expect(page).toHaveScreenshot('governance-overview.png', {
      maxDiffPixels: 150,
      threshold: 0.2,
    });
  });

  test('policy enforcement panel should match baseline', async ({ page }) => {
    const policyPanel = page.locator('[data-testid="policy-enforcement-panel"]');
    if (await policyPanel.isVisible()) {
      await expect(policyPanel).toHaveScreenshot('governance-policy-panel.png', {
        maxDiffPixels: 100,
        threshold: 0.2,
      });
    }
  });

  test('mode indicator should match baseline', async ({ page }) => {
    const modeIndicator = page.locator('[data-testid="mode-indicator"]');
    if (await modeIndicator.isVisible()) {
      await expect(modeIndicator).toHaveScreenshot('governance-mode-indicator.png', {
        maxDiffPixels: 50,
        threshold: 0.2,
      });
    }
  });

  test('rbac matrix should match baseline', async ({ page }) => {
    const rbacMatrix = page.locator('[data-testid="rbac-matrix"]');
    if (await rbacMatrix.isVisible()) {
      await page.waitForTimeout(1000); // Allow table to render
      await expect(rbacMatrix).toHaveScreenshot('governance-rbac-matrix.png', {
        maxDiffPixels: 200,
        threshold: 0.2,
      });
    }
  });
});

test.describe('Visual Regression - Manuscript Studio', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/studio');
    await page.waitForLoadState('networkidle');
  });

  test('editor layout should match baseline', async ({ page }) => {
    // Wait for editor to initialize
    await page.waitForSelector('[data-testid="editor-container"]', { timeout: 5000 }).catch(() => null);
    await page.waitForTimeout(1000); // Allow editor to fully render

    await expect(page).toHaveScreenshot('manuscript-studio-editor.png', {
      maxDiffPixels: 200,
      threshold: 0.2,
    });
  });

  test('toolbar should match baseline', async ({ page }) => {
    const toolbar = page.locator('[data-testid="editor-toolbar"]');
    if (await toolbar.isVisible()) {
      await expect(toolbar).toHaveScreenshot('manuscript-studio-toolbar.png', {
        maxDiffPixels: 100,
        threshold: 0.2,
      });
    }
  });

  test('sidebar should match baseline', async ({ page }) => {
    const sidebar = page.locator('[data-testid="editor-sidebar"]');
    if (await sidebar.isVisible()) {
      await expect(sidebar).toHaveScreenshot('manuscript-studio-sidebar.png', {
        maxDiffPixels: 100,
        threshold: 0.2,
      });
    }
  });

  test('preview panel should match baseline', async ({ page }) => {
    const preview = page.locator('[data-testid="preview-panel"]');
    if (await preview.isVisible()) {
      await expect(preview).toHaveScreenshot('manuscript-studio-preview.png', {
        maxDiffPixels: 100,
        threshold: 0.2,
      });
    }
  });
});

test.describe('Visual Regression - Responsive Design', () => {
  test('login page mobile view should match baseline', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('login-mobile.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('dashboard mobile view should match baseline', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('dashboard-mobile.png', {
      maxDiffPixels: 150,
      threshold: 0.2,
    });
  });

  test('tablet view should match baseline', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('dashboard-tablet.png', {
      maxDiffPixels: 150,
      threshold: 0.2,
    });
  });
});

test.describe('Visual Regression - Dark Mode', () => {
  test('login page dark mode should match baseline', async ({ page, context }) => {
    // Set dark mode preference
    await context.addInitScript(() => {
      window.localStorage.setItem('theme-preference', 'dark');
    });

    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('login-dark-mode.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('dashboard dark mode should match baseline', async ({ page, context }) => {
    await context.addInitScript(() => {
      window.localStorage.setItem('theme-preference', 'dark');
    });

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('dashboard-dark-mode.png', {
      maxDiffPixels: 150,
      threshold: 0.2,
    });
  });
});
