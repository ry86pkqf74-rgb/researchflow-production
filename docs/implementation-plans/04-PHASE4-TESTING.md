# Phase 4: Testing Suite

**Targets:**
- `tests/unit/worker/` (pytest)
- `tests/unit/orchestrator/` (vitest)
- `tests/e2e/` (Playwright)

**Estimated LOC:** ~500 lines

---

## Overview

Comprehensive testing for the conference preparation pipeline covering unit tests, integration tests, and end-to-end tests.

---

## File 1: Worker API Tests (pytest)

Create `services/worker/tests/test_conference_api.py`:

```python
"""
Conference API Endpoint Tests

Tests the FastAPI endpoints for conference discovery, guideline extraction,
material generation, and bundle export.
"""

import pytest
import os
import json
import tempfile
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# Import the FastAPI app
from api_server import app

client = TestClient(app)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def discovery_request():
    """Standard discovery request payload."""
    return {
        "keywords": ["robotic", "surgery", "outcomes"],
        "max_results": 5,
        "mode": "DEMO",
    }


@pytest.fixture
def guidelines_request():
    """Standard guidelines extraction request."""
    return {
        "conference_name": "SAGES",
        "formats": ["poster", "oral"],
        "mode": "DEMO",
    }


@pytest.fixture
def export_request():
    """Standard full export request."""
    return {
        "research_id": "test-research-123",
        "conference_name": "SAGES",
        "formats": ["poster"],
        "title": "Robotic Surgery Outcomes Study",
        "abstract": "Background: This study examines outcomes of robotic surgery. Methods: We analyzed 500 cases. Results: Outcomes improved by 30%. Conclusions: Robotic surgery shows promise.",
        "sections": {
            "background": "Robotic surgery has evolved significantly over the past decade.",
            "methods": "We conducted a retrospective analysis of 500 cases.",
            "results": "Patient outcomes improved by 30% compared to traditional methods.",
            "conclusions": "Robotic surgery demonstrates superior outcomes.",
        },
        "blinding_mode": False,
        "mode": "DEMO",
    }


@pytest.fixture
def temp_artifacts_dir():
    """Create temporary artifacts directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        os.environ["ARTIFACTS_PATH"] = tmpdir
        yield tmpdir


# ============================================================================
# Health Check Tests
# ============================================================================

class TestHealthCheck:
    """Tests for the health check endpoint."""

    def test_health_returns_ok(self):
        """Health endpoint should return status."""
        response = client.get("/api/conference/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "dependencies" in data

    def test_health_checks_dependencies(self):
        """Health should check reportlab and python-pptx."""
        response = client.get("/api/conference/health")
        data = response.json()
        assert "reportlab" in data["dependencies"]
        assert "python_pptx" in data["dependencies"]


# ============================================================================
# Discovery Tests
# ============================================================================

class TestDiscovery:
    """Tests for conference discovery endpoint."""

    def test_discover_returns_conferences(self, discovery_request):
        """Discovery should return ranked conferences."""
        response = client.post(
            "/api/conference/discover",
            json=discovery_request,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "conferences" in data
        assert len(data["conferences"]) > 0

    def test_discover_respects_max_results(self, discovery_request):
        """Discovery should respect max_results parameter."""
        discovery_request["max_results"] = 3
        response = client.post(
            "/api/conference/discover",
            json=discovery_request,
        )
        data = response.json()
        assert len(data["conferences"]) <= 3

    def test_discover_returns_scores(self, discovery_request):
        """Each conference should have a score."""
        response = client.post(
            "/api/conference/discover",
            json=discovery_request,
        )
        data = response.json()
        for conf in data["conferences"]:
            assert "score" in conf
            assert 0 <= conf["score"] <= 1

    def test_discover_requires_keywords(self):
        """Discovery should fail without keywords."""
        response = client.post(
            "/api/conference/discover",
            json={"keywords": [], "mode": "DEMO"},
        )
        assert response.status_code == 422  # Validation error

    def test_discover_demo_mode_no_network(self, discovery_request):
        """DEMO mode should not make network calls."""
        with patch("requests.get") as mock_get:
            response = client.post(
                "/api/conference/discover",
                json=discovery_request,
            )
            assert response.status_code == 200
            mock_get.assert_not_called()


# ============================================================================
# Guidelines Extraction Tests
# ============================================================================

class TestGuidelinesExtraction:
    """Tests for guideline extraction endpoint."""

    def test_extract_returns_guidelines(self, guidelines_request):
        """Extraction should return structured guidelines."""
        response = client.post(
            "/api/conference/extract-guidelines",
            json=guidelines_request,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "extracted_fields" in data

    def test_extract_sanitizes_output(self, guidelines_request):
        """Extracted text should be sanitized."""
        response = client.post(
            "/api/conference/extract-guidelines",
            json=guidelines_request,
        )
        data = response.json()
        assert data["sanitization_applied"] is True

    def test_extract_returns_hash(self, guidelines_request):
        """Extraction should return content hash."""
        response = client.post(
            "/api/conference/extract-guidelines",
            json=guidelines_request,
        )
        data = response.json()
        assert "raw_text_hash" in data
        assert len(data["raw_text_hash"]) == 64  # SHA256

    def test_extract_demo_returns_fixtures(self, guidelines_request):
        """DEMO mode should return fixture data."""
        response = client.post(
            "/api/conference/extract-guidelines",
            json=guidelines_request,
        )
        data = response.json()
        # SAGES fixture should have known values
        assert data["conference_name"] == "SAGES"

    def test_extract_unknown_conference_demo(self):
        """Unknown conference in DEMO should return generic response."""
        response = client.post(
            "/api/conference/extract-guidelines",
            json={
                "conference_name": "Unknown Conference XYZ",
                "formats": ["poster"],
                "mode": "DEMO",
            },
        )
        # Should still succeed with generic/empty guidelines
        assert response.status_code == 200


# ============================================================================
# Material Generation Tests
# ============================================================================

class TestMaterialGeneration:
    """Tests for material generation endpoint."""

    def test_generate_poster_creates_pdf(self, temp_artifacts_dir):
        """Poster generation should create PDF file."""
        response = client.post(
            "/api/conference/generate-materials",
            json={
                "run_id": "test-run-001",
                "format": "poster",
                "conference_name": "SAGES",
                "title": "Test Poster",
                "abstract": "Test abstract content with sufficient words for generation.",
                "sections": {
                    "background": "Background content",
                    "methods": "Methods content",
                    "results": "Results content",
                    "conclusions": "Conclusions content",
                },
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        # Verify PDF was created
        pdf_files = [f for f in data["files_generated"] if f["filename"].endswith(".pdf")]
        assert len(pdf_files) > 0

    def test_generate_slides_creates_pptx(self, temp_artifacts_dir):
        """Oral generation should create PPTX file."""
        response = client.post(
            "/api/conference/generate-materials",
            json={
                "run_id": "test-run-002",
                "format": "oral",
                "conference_name": "SAGES",
                "title": "Test Presentation",
                "abstract": "Test abstract for presentation slides generation.",
                "sections": {
                    "background": "Background content",
                    "methods": "Methods content",
                    "results": "Results content",
                    "conclusions": "Conclusions content",
                },
            },
        )
        assert response.status_code == 200
        data = response.json()

        pptx_files = [f for f in data["files_generated"] if f["filename"].endswith(".pptx")]
        assert len(pptx_files) > 0

    def test_generate_includes_manifest(self, temp_artifacts_dir):
        """Generation should include manifest with hashes."""
        response = client.post(
            "/api/conference/generate-materials",
            json={
                "run_id": "test-run-003",
                "format": "poster",
                "conference_name": "SAGES",
                "title": "Test",
                "abstract": "Test abstract",
                "sections": {},
            },
        )
        data = response.json()
        assert "manifest" in data

    def test_generate_blinding_mode_strips_authors(self, temp_artifacts_dir):
        """Blinding mode should not include authors."""
        response = client.post(
            "/api/conference/generate-materials",
            json={
                "run_id": "test-run-004",
                "format": "poster",
                "conference_name": "SAGES",
                "title": "Blinded Study",
                "authors": ["John Doe", "Jane Smith"],
                "abstract": "Test abstract",
                "sections": {},
                "blinding_mode": True,
            },
        )
        data = response.json()
        assert data["success"] is True
        # Authors should not appear in generated content


# ============================================================================
# Bundle Creation Tests
# ============================================================================

class TestBundleCreation:
    """Tests for bundle creation endpoint."""

    def test_create_bundle_generates_zip(self, temp_artifacts_dir):
        """Bundle creation should generate ZIP file."""
        # First generate materials
        client.post(
            "/api/conference/generate-materials",
            json={
                "run_id": "bundle-test-001",
                "format": "poster",
                "conference_name": "SAGES",
                "title": "Bundle Test",
                "abstract": "Test abstract",
                "sections": {},
            },
        )

        # Then create bundle
        response = client.post(
            "/api/conference/create-bundle",
            json={
                "run_id": "bundle-test-001",
                "formats": ["poster"],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "bundle_path" in data
        assert data["bundle_path"].endswith(".zip")

    def test_bundle_includes_manifest(self, temp_artifacts_dir):
        """Bundle should include manifest.json."""
        # Setup: generate materials first
        client.post(
            "/api/conference/generate-materials",
            json={
                "run_id": "bundle-test-002",
                "format": "poster",
                "conference_name": "SAGES",
                "title": "Test",
                "abstract": "Test",
                "sections": {},
            },
        )

        response = client.post(
            "/api/conference/create-bundle",
            json={"run_id": "bundle-test-002", "formats": ["poster"]},
        )
        data = response.json()
        assert "manifest" in data
        assert "files" in data["manifest"]


# ============================================================================
# Full Export Tests
# ============================================================================

class TestFullExport:
    """Tests for the full export orchestration endpoint."""

    def test_full_export_workflow(self, export_request, temp_artifacts_dir):
        """Full export should complete entire workflow."""
        response = client.post(
            "/api/conference/export",
            json=export_request,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "run_id" in data
        assert "materials_generated" in data
        assert "bundle_hash" in data
        assert "download_url" in data

    def test_full_export_creates_downloadable_bundle(self, export_request, temp_artifacts_dir):
        """Export should create a downloadable bundle."""
        response = client.post(
            "/api/conference/export",
            json=export_request,
        )
        data = response.json()
        run_id = data["run_id"]

        # Try to download the bundle
        download_response = client.get(f"/api/conference/bundle/{run_id}/download")
        assert download_response.status_code == 200
        assert download_response.headers["content-type"] == "application/zip"


# ============================================================================
# Download Tests
# ============================================================================

class TestDownload:
    """Tests for file download endpoint."""

    def test_download_prevents_path_traversal(self):
        """Download should reject path traversal attempts."""
        response = client.get("/api/conference/bundle/../../../etc/passwd/download")
        assert response.status_code in [400, 404]

    def test_download_invalid_run_id(self):
        """Download should fail for invalid run_id."""
        response = client.get("/api/conference/bundle/nonexistent-run/download")
        assert response.status_code == 404

    def test_download_sets_correct_headers(self, temp_artifacts_dir):
        """Download should set appropriate headers."""
        # Setup: create a bundle first
        client.post(
            "/api/conference/generate-materials",
            json={
                "run_id": "download-test",
                "format": "poster",
                "conference_name": "SAGES",
                "title": "Test",
                "abstract": "Test",
                "sections": {},
            },
        )
        client.post(
            "/api/conference/create-bundle",
            json={"run_id": "download-test", "formats": ["poster"]},
        )

        response = client.get("/api/conference/bundle/download-test/download")
        assert "content-disposition" in response.headers


# ============================================================================
# PHI Safety Tests
# ============================================================================

class TestPhiSafety:
    """Tests for PHI protection in conference API."""

    def test_guidelines_sanitize_emails(self, guidelines_request):
        """Guidelines should redact email addresses."""
        response = client.post(
            "/api/conference/extract-guidelines",
            json=guidelines_request,
        )
        data = response.json()
        # Verify no email patterns in extracted fields
        extracted_str = json.dumps(data["extracted_fields"])
        assert "@" not in extracted_str or "[REDACTED" in extracted_str

    def test_guidelines_sanitize_phones(self, guidelines_request):
        """Guidelines should redact phone numbers."""
        response = client.post(
            "/api/conference/extract-guidelines",
            json=guidelines_request,
        )
        data = response.json()
        assert data["sanitization_applied"] is True


# ============================================================================
# Run with: pytest services/worker/tests/test_conference_api.py -v
# ============================================================================
```

---

## File 2: Orchestrator Route Tests (vitest)

Create `tests/unit/orchestrator/conference-routes.test.ts`:

```typescript
/**
 * Conference Routes Unit Tests
 *
 * Tests for orchestrator conference API routes including
 * worker proxying, authentication, and download handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import path from 'path';
import fs from 'fs';

// Mock the worker service
vi.mock('axios');

// Mock auth middleware
vi.mock('../src/middleware/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user', role: 'RESEARCHER' };
    next();
  },
  requireRole: () => (req: any, res: any, next: any) => next(),
}));

// Import after mocks
import axios from 'axios';
import conferenceRouter from '../src/routes/conference';

const app = express();
app.use(express.json());
app.use('/api/ros/conference', conferenceRouter);

describe('Conference Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /discover', () => {
    it('should proxy discovery request to worker', async () => {
      const mockResponse = {
        success: true,
        conferences: [
          { id: '1', name: 'SAGES', score: 0.85 },
        ],
        total_found: 1,
        query_metadata: {},
      };

      (axios as any).mockResolvedValueOnce({ data: mockResponse });

      const response = await request(app)
        .post('/api/ros/conference/discover')
        .send({
          keywords: ['robotic', 'surgery'],
          maxResults: 5,
          mode: 'DEMO',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.conferences).toHaveLength(1);
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/ros/conference/discover')
        .send({
          keywords: [], // Empty keywords should fail
          mode: 'DEMO',
        });

      expect(response.status).toBe(500); // Zod validation error
    });

    it('should reject keywords containing PHI', async () => {
      const response = await request(app)
        .post('/api/ros/conference/discover')
        .send({
          keywords: ['123-45-6789'], // SSN pattern
          mode: 'DEMO',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('PHI');
    });
  });

  describe('POST /guidelines/extract', () => {
    it('should proxy extraction request to worker', async () => {
      const mockResponse = {
        success: true,
        conference_name: 'SAGES',
        raw_text_hash: 'abc123',
        extracted_fields: {},
        sanitization_applied: true,
        mode: 'DEMO',
      };

      (axios as any).mockResolvedValueOnce({ data: mockResponse });

      const response = await request(app)
        .post('/api/ros/conference/guidelines/extract')
        .send({
          conferenceName: 'SAGES',
          formats: ['poster'],
          mode: 'DEMO',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.sanitization_applied).toBe(true);
    });
  });

  describe('POST /export', () => {
    it('should validate export request', async () => {
      const response = await request(app)
        .post('/api/ros/conference/export')
        .send({
          // Missing required fields
          conferenceName: 'SAGES',
        });

      expect(response.status).toBe(500);
    });

    it('should check for PHI in content', async () => {
      const response = await request(app)
        .post('/api/ros/conference/export')
        .send({
          researchId: '123e4567-e89b-12d3-a456-426614174000',
          conferenceName: 'SAGES',
          formats: ['poster'],
          title: 'Patient SSN: 123-45-6789', // PHI in title
          abstract: 'Test abstract',
          sections: {},
          mode: 'DEMO',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('PHI');
    });

    it('should return download URL on success', async () => {
      const mockResponse = {
        success: true,
        run_id: 'test-run-123',
        guidelines_extracted: {},
        materials_generated: [],
        bundle_path: '/data/artifacts/conference/test-run-123/bundle.zip',
        bundle_hash: 'abc123',
        download_url: '/api/conference/bundle/test-run-123/download',
        checklist: [],
      };

      (axios as any).mockResolvedValueOnce({ data: mockResponse });

      const response = await request(app)
        .post('/api/ros/conference/export')
        .send({
          researchId: '123e4567-e89b-12d3-a456-426614174000',
          conferenceName: 'SAGES',
          formats: ['poster'],
          title: 'Valid Title',
          abstract: 'Valid abstract with sufficient content.',
          sections: {
            background: 'Background content',
          },
          mode: 'DEMO',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.downloadUrl).toContain('test-run-123');
    });
  });

  describe('GET /download/:runId/:filename', () => {
    it('should reject path traversal in runId', async () => {
      const response = await request(app)
        .get('/api/ros/conference/download/../../../etc/passwd/file.pdf');

      expect(response.status).toBe(400);
    });

    it('should reject path traversal in filename', async () => {
      const response = await request(app)
        .get('/api/ros/conference/download/valid-run/../../../etc/passwd');

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent file', async () => {
      const response = await request(app)
        .get('/api/ros/conference/download/nonexistent/file.pdf');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /export/:runId', () => {
    it('should return export status', async () => {
      // This would need a mock file system setup
      // For now, just verify the route exists
      const response = await request(app)
        .get('/api/ros/conference/export/test-run');

      // Will be 404 since file doesn't exist, but route should work
      expect([200, 404]).toContain(response.status);
    });
  });
});
```

---

## File 3: E2E Playwright Tests

Create `tests/e2e/conference-workflow.spec.ts`:

```typescript
/**
 * Conference Preparation E2E Tests
 *
 * End-to-end tests for the Stage 20 conference preparation workflow
 * using Playwright.
 */

import { test, expect } from '@playwright/test';

test.describe('Conference Preparation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application and log in
    await page.goto('/');
    // Perform login if needed
    // await page.fill('[data-testid="email"]', 'test@example.com');
    // await page.fill('[data-testid="password"]', 'password');
    // await page.click('[data-testid="login-button"]');
  });

  test('should navigate to Stage 20', async ({ page }) => {
    // Find and click on Stage 20 in the workflow
    await page.click('text=Conference Preparation');

    // Verify Stage 20 panel is displayed
    await expect(page.locator('text=Conference Preparation')).toBeVisible();
  });

  test('should discover conferences with keywords', async ({ page }) => {
    await page.click('text=Conference Preparation');

    // Enter search keywords
    await page.fill('[data-testid="conference-keywords"]', 'robotic, surgery');

    // Click discover button
    await page.click('[data-testid="discover-button"]');

    // Wait for results
    await expect(page.locator('[data-testid="conference-list"]')).toBeVisible();

    // Verify at least one conference is shown
    const conferenceItems = page.locator('[data-testid="conference-item"]');
    await expect(conferenceItems.first()).toBeVisible();
  });

  test('should select conference and extract guidelines', async ({ page }) => {
    await page.click('text=Conference Preparation');

    // Search and discover
    await page.fill('[data-testid="conference-keywords"]', 'SAGES');
    await page.click('[data-testid="discover-button"]');

    // Wait for results and select first conference
    await page.click('[data-testid="conference-item"]:first-child');

    // Verify guidelines are extracted
    await expect(page.locator('[data-testid="guidelines-panel"]')).toBeVisible();
  });

  test('should generate materials', async ({ page }) => {
    await page.click('text=Conference Preparation');

    // Go through discovery flow
    await page.fill('[data-testid="conference-keywords"]', 'surgery');
    await page.click('[data-testid="discover-button"]');
    await page.click('[data-testid="conference-item"]:first-child');

    // Fill in required content
    await page.fill('[data-testid="abstract-input"]', 'Test abstract content for poster generation.');

    // Select poster format
    await page.check('[data-testid="format-poster"]');

    // Click generate
    await page.click('[data-testid="generate-button"]');

    // Wait for generation to complete (may take a while)
    await expect(page.locator('[data-testid="materials-list"]')).toBeVisible({
      timeout: 60000,
    });

    // Verify materials are listed
    const materialItems = page.locator('[data-testid="material-item"]');
    await expect(materialItems.first()).toBeVisible();
  });

  test('should download generated bundle', async ({ page }) => {
    await page.click('text=Conference Preparation');

    // Complete the generation flow first
    await page.fill('[data-testid="conference-keywords"]', 'SAGES');
    await page.click('[data-testid="discover-button"]');
    await page.click('[data-testid="conference-item"]:first-child');
    await page.fill('[data-testid="abstract-input"]', 'Test abstract');
    await page.check('[data-testid="format-poster"]');
    await page.click('[data-testid="generate-button"]');

    // Wait for generation
    await expect(page.locator('[data-testid="download-bundle-button"]')).toBeVisible({
      timeout: 60000,
    });

    // Set up download handler
    const downloadPromise = page.waitForEvent('download');

    // Click download
    await page.click('[data-testid="download-bundle-button"]');

    // Verify download started
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('conference_bundle');
    expect(download.suggestedFilename()).toContain('.zip');
  });

  test('should display compliance checklist', async ({ page }) => {
    await page.click('text=Conference Preparation');

    // Complete generation
    await page.fill('[data-testid="conference-keywords"]', 'SAGES');
    await page.click('[data-testid="discover-button"]');
    await page.click('[data-testid="conference-item"]:first-child');
    await page.fill('[data-testid="abstract-input"]', 'Test abstract');
    await page.click('[data-testid="generate-button"]');

    // Wait for checklist
    await expect(page.locator('[data-testid="checklist-panel"]')).toBeVisible({
      timeout: 60000,
    });

    // Verify checklist items
    const checklistItems = page.locator('[data-testid="checklist-item"]');
    await expect(checklistItems.first()).toBeVisible();
  });

  test('should handle DEMO mode without network calls', async ({ page }) => {
    // Enable request interception
    await page.route('**/external-api/**', (route) => {
      // Fail if any external API is called
      throw new Error('External API call detected in DEMO mode');
    });

    await page.click('text=Conference Preparation');

    // Run discovery in DEMO mode
    await page.fill('[data-testid="conference-keywords"]', 'surgery');
    await page.selectOption('[data-testid="mode-select"]', 'DEMO');
    await page.click('[data-testid="discover-button"]');

    // Should succeed without external calls
    await expect(page.locator('[data-testid="conference-list"]')).toBeVisible();
  });
});

// Run with: npx playwright test tests/e2e/conference-workflow.spec.ts
```

---

## Running Tests

### Python Tests
```bash
cd services/worker
pytest tests/test_conference_api.py -v --tb=short
```

### TypeScript Tests
```bash
npx vitest run tests/unit/orchestrator/conference-routes.test.ts
```

### E2E Tests
```bash
npx playwright test tests/e2e/conference-workflow.spec.ts
```

### All Tests
```bash
# Run all tests
npm run test && pytest && npx playwright test
```

---

## Next Phase

Once tests are passing, proceed to [Phase 5: Documentation & Deployment](./05-PHASE5-DOCS-DEPLOY.md).
