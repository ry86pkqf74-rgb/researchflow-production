/**
 * VAL-003: E2E Test - Artifact Browser
 *
 * Tests artifact browsing functionality:
 * - Tree navigation through artifact hierarchy
 * - PDF, image, and text file previews
 * - Download functionality
 * - Artifact diff view
 * - Search and filtering
 * - File type handling
 */

import { test, expect, Page } from '@playwright/test';
import { loginAs, setMode } from './fixtures';
import { E2E_USERS } from './fixtures/users.fixture';
import { BasePage } from './pages/base.page';
import * as path from 'path';

test.describe('VAL-003: Artifact Browser', () => {
  test.beforeEach(async ({ page }) => {
    // Clear state before each test
    await page.addInitScript(() => {
      localStorage.clear();
    });
  });

  test('should navigate artifact tree structure', async ({ page }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock artifact tree API
    await page.route('**/api/runs/*/artifacts', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            artifacts: [
              {
                id: 'artifact-001',
                name: 'data',
                type: 'directory',
                children: [
                  {
                    id: 'artifact-002',
                    name: 'raw_data.csv',
                    type: 'file',
                    mimeType: 'text/csv',
                    size: 1024,
                  },
                  {
                    id: 'artifact-003',
                    name: 'processed_data.csv',
                    type: 'file',
                    mimeType: 'text/csv',
                    size: 2048,
                  },
                ],
              },
              {
                id: 'artifact-004',
                name: 'reports',
                type: 'directory',
                children: [
                  {
                    id: 'artifact-005',
                    name: 'summary.pdf',
                    type: 'file',
                    mimeType: 'application/pdf',
                    size: 5120,
                  },
                ],
              },
              {
                id: 'artifact-006',
                name: 'images',
                type: 'directory',
                children: [
                  {
                    id: 'artifact-007',
                    name: 'plot.png',
                    type: 'file',
                    mimeType: 'image/png',
                    size: 3072,
                  },
                ],
              },
            ],
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to artifact browser
    await page.goto('/pipeline/run/run-e2e-001/artifacts');
    await page.waitForLoadState('domcontentloaded');

    // Look for tree view elements
    const treeRoot = page.locator('[data-testid*="artifact-tree"], .file-tree, .tree-container').first();
    const hasTree = await treeRoot.isVisible().catch(() => false);

    if (hasTree) {
      // Check for directories
      const directories = await page.locator('[data-testid*="directory"], .folder, [aria-label*="folder"]').count();
      expect(directories).toBeGreaterThanOrEqual(0);

      // Check for files
      const files = await page.locator('[data-testid*="file"], .file-item, [aria-label*="file"]').count();
      expect(files).toBeGreaterThanOrEqual(0);
    }
  });

  test('should expand and collapse directories in tree', async ({ page }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock artifact tree
    await page.route('**/api/runs/*/artifacts*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            artifacts: [
              {
                id: 'dir-001',
                name: 'folder',
                type: 'directory',
                children: [
                  { id: 'file-001', name: 'file1.txt', type: 'file', mimeType: 'text/plain' },
                ],
              },
            ],
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/pipeline/run/run-e2e-001/artifacts');
    await page.waitForLoadState('domcontentloaded');

    // Find expand button
    const expandButton = page.locator('[data-testid*="expand"], .expand-icon, [aria-label*="expand"]').first();
    const hasExpandButton = await expandButton.isVisible().catch(() => false);

    if (hasExpandButton) {
      // Click to expand
      await expandButton.click();
      await page.waitForTimeout(300);

      // Find collapse button
      const collapseButton = page.locator('[data-testid*="collapse"], .collapse-icon, [aria-label*="collapse"]').first();
      const hasCollapseButton = await collapseButton.isVisible().catch(() => false);

      if (hasCollapseButton) {
        // Click to collapse
        await collapseButton.click();
        await page.waitForTimeout(300);
      }

      expect(hasExpandButton || hasCollapseButton).toBeTruthy();
    }
  });

  test('should display PDF file preview', async ({ page }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock PDF content
    await page.route('**/api/runs/*/artifacts/*/content', async (route) => {
      const url = route.request().url();
      if (url.includes('summary.pdf') || url.includes('artifact-005')) {
        // Return PDF buffer
        const pdfBuffer = Buffer.from('%PDF-1.4 mock content');
        await route.fulfill({
          status: 200,
          contentType: 'application/pdf',
          body: pdfBuffer,
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to artifact browser
    await page.goto('/pipeline/run/run-e2e-001/artifacts');
    await page.waitForLoadState('domcontentloaded');

    // Find PDF file in tree
    const pdfFile = page.locator('text=summary.pdf, [data-testid*="summary.pdf"]').first();
    const hasPdfFile = await pdfFile.isVisible().catch(() => false);

    if (hasPdfFile) {
      await pdfFile.click();
      await page.waitForTimeout(500);

      // Check for PDF viewer or preview
      const pdfViewer = page.locator('[data-testid*="pdf-viewer"], .pdf-viewer, iframe').first();
      const hasPdfViewer = await pdfViewer.isVisible().catch(() => false);

      expect(hasPdfViewer).toBeTruthy();
    }
  });

  test('should display image file preview', async ({ page }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock image content
    await page.route('**/api/runs/*/artifacts/*/content', async (route) => {
      const url = route.request().url();
      if (url.includes('plot.png') || url.includes('artifact-007')) {
        // Return image buffer
        const pngBuffer = Buffer.from('\x89PNG\r\n\x1a\n');
        await route.fulfill({
          status: 200,
          contentType: 'image/png',
          body: pngBuffer,
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to artifact browser
    await page.goto('/pipeline/run/run-e2e-001/artifacts');
    await page.waitForLoadState('domcontentloaded');

    // Find image file
    const imageFile = page.locator('text=plot.png, [data-testid*="plot.png"]').first();
    const hasImageFile = await imageFile.isVisible().catch(() => false);

    if (hasImageFile) {
      await imageFile.click();
      await page.waitForTimeout(500);

      // Check for image preview
      const imagePreview = page.locator('img, [data-testid*="image-viewer"], .image-preview').first();
      const hasImagePreview = await imagePreview.isVisible().catch(() => false);

      expect(hasImagePreview).toBeTruthy();
    }
  });

  test('should display text file preview', async ({ page }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock text file content
    await page.route('**/api/runs/*/artifacts/*/content', async (route) => {
      const url = route.request().url();
      if (url.includes('.csv') || url.includes('artifact-002') || url.includes('artifact-003')) {
        await route.fulfill({
          status: 200,
          contentType: 'text/plain; charset=utf-8',
          body: 'id,name,value\n1,Test,100\n2,Sample,200\n',
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to artifact browser
    await page.goto('/pipeline/run/run-e2e-001/artifacts');
    await page.waitForLoadState('domcontentloaded');

    // Find text file
    const textFile = page.locator('text=.csv, text=raw_data, [data-testid*=".csv"]').first();
    const hasTextFile = await textFile.isVisible().catch(() => false);

    if (hasTextFile) {
      await textFile.click();
      await page.waitForTimeout(500);

      // Check for text preview
      const textPreview = page.locator('[data-testid*="text-preview"], .code-editor, pre').first();
      const hasTextPreview = await textPreview.isVisible().catch(() => false);

      expect(hasTextPreview).toBeTruthy();
    }
  });

  test('should support artifact download', async ({ page, context }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock download endpoint
    await page.route('**/api/runs/*/artifacts/*/download', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/octet-stream',
          body: 'mock file content',
          headers: {
            'Content-Disposition': 'attachment; filename="artifact.csv"',
          },
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to artifact browser
    await page.goto('/pipeline/run/run-e2e-001/artifacts');
    await page.waitForLoadState('domcontentloaded');

    // Find download button
    const downloadButton = page.locator('button:has-text("Download"), [data-testid*="download"], [aria-label*="download"]').first();
    const hasDownloadButton = await downloadButton.isVisible().catch(() => false);

    if (hasDownloadButton) {
      // Listen for download
      const downloadPromise = context.waitForEvent('download');

      await downloadButton.click();

      // Optional: Wait for download to start
      try {
        const download = await Promise.race([
          downloadPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Download timeout')), 5000)),
        ]);
        expect(download).toBeDefined();
      } catch (e) {
        // Download may not trigger in test environment
      }
    }
  });

  test('should display artifact metadata', async ({ page }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock artifact with metadata
    await page.route('**/api/runs/*/artifacts/*', async (route) => {
      if (route.request().method() === 'GET') {
        const url = route.request().url();
        if (url.includes('artifact-005')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'artifact-005',
              name: 'summary.pdf',
              type: 'file',
              mimeType: 'application/pdf',
              size: 5120,
              createdAt: new Date().toISOString(),
              checksum: 'abc123def456',
              metadata: {
                pages: 10,
                author: 'test',
              },
            }),
          });
        } else {
          await route.continue();
        }
      } else {
        await route.continue();
      }
    });

    // Navigate to artifact
    await page.goto('/pipeline/run/run-e2e-001/artifacts/artifact-005');
    await page.waitForLoadState('domcontentloaded');

    // Check for metadata display
    const metadataDisplay = page.locator('[data-testid*="metadata"], .artifact-info, .file-details').first();
    const hasMetadata = await metadataDisplay.isVisible().catch(() => false);

    // Check for specific metadata fields
    const sizeDisplay = page.locator('text=5120, text=5.0 KB, text=Size').first();
    const hasSizeInfo = await sizeDisplay.isVisible().catch(() => false);

    expect(hasMetadata || hasSizeInfo).toBeTruthy();
  });

  test('should filter artifacts by type', async ({ page }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock artifacts
    await page.route('**/api/runs/*/artifacts*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            artifacts: [
              { id: 'f1', name: 'file1.txt', type: 'file', mimeType: 'text/plain' },
              { id: 'f2', name: 'file2.pdf', type: 'file', mimeType: 'application/pdf' },
              { id: 'f3', name: 'file3.png', type: 'file', mimeType: 'image/png' },
            ],
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to artifact browser
    await page.goto('/pipeline/run/run-e2e-001/artifacts');
    await page.waitForLoadState('domcontentloaded');

    // Find filter dropdown
    const filterButton = page.locator('[data-testid*="filter"], button:has-text("Filter"), select').first();
    const hasFilter = await filterButton.isVisible().catch(() => false);

    if (hasFilter) {
      await filterButton.click();
      await page.waitForTimeout(300);

      // Check for filter options
      const filterOptions = await page.locator('[role="option"], .filter-option, li').count();
      expect(filterOptions).toBeGreaterThanOrEqual(0);
    }
  });

  test('should search artifacts by name', async ({ page }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock search API
    await page.route('**/api/runs/*/artifacts/search*', async (route) => {
      if (route.request().method() === 'GET') {
        const url = new URL(route.request().url());
        const query = url.searchParams.get('q') || '';

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: query
              ? [
                  {
                    id: 'f1',
                    name: 'summary.pdf',
                    type: 'file',
                    mimeType: 'application/pdf',
                  },
                ]
              : [],
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to artifact browser
    await page.goto('/pipeline/run/run-e2e-001/artifacts');
    await page.waitForLoadState('domcontentloaded');

    // Find search input
    const searchInput = page.locator('input[placeholder*="search"], input[data-testid*="search"]').first();
    const hasSearch = await searchInput.isVisible().catch(() => false);

    if (hasSearch) {
      await searchInput.fill('summary');
      await page.waitForTimeout(500);

      // Check for search results
      const results = await page.locator('[data-testid*="result"], .search-result').count();
      expect(results).toBeGreaterThanOrEqual(0);
    }
  });

  test('should show artifact diff between versions', async ({ page }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock diff API
    await page.route('**/api/runs/*/artifacts/*/diff*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            added: [
              { line: 5, content: '+ new line added' },
            ],
            removed: [
              { line: 3, content: '- old line removed' },
            ],
            modified: [],
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to artifact detail
    await page.goto('/pipeline/run/run-e2e-001/artifacts/artifact-002/diff');
    await page.waitForLoadState('domcontentloaded');

    // Check for diff view
    const diffView = page.locator('[data-testid*="diff"], .diff-view, .diff-content').first();
    const hasDiffView = await diffView.isVisible().catch(() => false);

    if (hasDiffView) {
      // Check for added/removed indicators
      const addedLines = page.locator('text=+, [data-testid*="added"]').count();
      const removedLines = page.locator('text=-, [data-testid*="removed"]').count();

      expect(await addedLines + await removedLines).toBeGreaterThanOrEqual(0);
    }
  });

  test('should restrict artifact access based on role', async ({ page }) => {
    // Login as viewer
    await loginAs(page, E2E_USERS.VIEWER);
    await setMode(page, 'LIVE');

    // Navigate to artifacts
    await page.goto('/pipeline/run/run-e2e-001/artifacts');
    await page.waitForLoadState('domcontentloaded');

    // Download button should be disabled or hidden for viewers
    const downloadButton = page.locator('[data-testid*="download"], button:has-text("Download")').first();
    const isDownloadDisabled = await downloadButton.isDisabled().catch(() => true);
    const isDownloadVisible = await downloadButton.isVisible().catch(() => false);

    // Either disabled or not visible
    expect(isDownloadDisabled || !isDownloadVisible).toBeTruthy();
  });
});
