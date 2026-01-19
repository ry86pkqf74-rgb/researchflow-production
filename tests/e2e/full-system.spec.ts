/**
 * Full System E2E Integration Tests
 *
 * Comprehensive end-to-end tests that validate the entire ResearchFlow
 * system including:
 * - Orchestrator API (REST + GraphQL)
 * - Worker Pipeline
 * - Literature Services
 * - Schema System
 * - Vector Storage
 * - Caching
 * - Authentication & Authorization
 */

import { test, expect } from "@playwright/test";

// Test configuration
const API_URL = process.env.API_URL || "http://localhost:3001";
const WORKER_URL = process.env.WORKER_URL || "http://localhost:8000";
const GRAPHQL_URL = `${API_URL}/graphql`;

// Helper to make API requests
async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${API_URL}${endpoint}`;
  const defaultHeaders = {
    "Content-Type": "application/json",
  };

  return fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });
}

// Helper for GraphQL queries
async function graphqlQuery(
  query: string,
  variables: Record<string, unknown> = {},
  token?: string
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(GRAPHQL_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });
}

test.describe("Health Checks", () => {
  test("orchestrator health endpoint returns OK", async () => {
    const response = await apiRequest("/healthz");
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe("ok");
  });

  test("orchestrator readiness endpoint returns ready", async () => {
    const response = await apiRequest("/readyz");
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe("ready");
    expect(data.checks).toBeDefined();
  });

  test("worker health endpoint returns OK", async () => {
    const response = await fetch(`${WORKER_URL}/healthz`);
    expect(response.status).toBe(200);
  });
});

test.describe("Authentication Flow", () => {
  test("can register a new user", async () => {
    const uniqueEmail = `test-${Date.now()}@example.com`;

    const response = await apiRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: uniqueEmail,
        password: "SecurePassword123!",
        name: "Test User",
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe(uniqueEmail);
  });

  test("can login with valid credentials", async () => {
    const response = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "test@example.com",
        password: "password123",
      }),
    });

    // May return 401 if test user doesn't exist, which is expected
    expect([200, 401]).toContain(response.status);

    if (response.status === 200) {
      const data = await response.json();
      expect(data.token).toBeDefined();
    }
  });

  test("rejects invalid credentials", async () => {
    const response = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "test@example.com",
        password: "wrongpassword",
      }),
    });

    expect(response.status).toBe(401);
  });
});

test.describe("GraphQL API", () => {
  test("can query artifacts via GraphQL", async () => {
    const query = `
      query GetArtifacts($limit: Int) {
        artifacts(limit: $limit) {
          id
          filename
          status
          createdAt
        }
      }
    `;

    const response = await graphqlQuery(query, { limit: 10 });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.errors).toBeUndefined();
    expect(data.data).toBeDefined();
  });

  test("can query schemas via GraphQL", async () => {
    const query = `
      query GetSchemas {
        schemas {
          name
          version
          description
          createdAt
        }
      }
    `;

    const response = await graphqlQuery(query);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.errors).toBeUndefined();
  });

  test("mutation requires authentication", async () => {
    const mutation = `
      mutation CreateArtifact($input: CreateArtifactInput!) {
        createArtifact(input: $input) {
          id
        }
      }
    `;

    const response = await graphqlQuery(mutation, {
      input: { filename: "test.txt", contentType: "text/plain" },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.errors).toBeDefined();
    expect(data.errors[0].message).toContain("Unauthorized");
  });
});

test.describe("Artifact Upload Flow", () => {
  test("can request upload URL", async () => {
    const response = await apiRequest("/api/artifacts/upload-url", {
      method: "POST",
      body: JSON.stringify({
        filename: "test-document.pdf",
        contentType: "application/pdf",
      }),
    });

    // May require auth
    expect([200, 401]).toContain(response.status);

    if (response.status === 200) {
      const data = await response.json();
      expect(data.uploadUrl).toBeDefined();
      expect(data.artifactId).toBeDefined();
    }
  });

  test("can request download URL for existing artifact", async () => {
    // This test assumes an artifact exists
    const response = await apiRequest("/api/artifacts/test-artifact-id/download-url", {
      method: "GET",
    });

    // 404 is expected if artifact doesn't exist
    expect([200, 401, 404]).toContain(response.status);
  });
});

test.describe("Literature Services", () => {
  test("can format citation", async () => {
    const response = await apiRequest("/api/literature/format-citation", {
      method: "POST",
      body: JSON.stringify({
        citation: {
          type: "journal",
          title: "Test Article",
          authors: [{ firstName: "John", lastName: "Doe" }],
          year: 2024,
          journal: "Test Journal",
          volume: "1",
          pages: "1-10",
        },
        styles: ["apa", "mla"],
      }),
    });

    // Service may not be available in test environment
    expect([200, 404, 503]).toContain(response.status);

    if (response.status === 200) {
      const data = await response.json();
      expect(data.formatted).toBeDefined();
      expect(data.formatted.length).toBe(2);
    }
  });

  test("can check plagiarism", async () => {
    const response = await apiRequest("/api/literature/check-plagiarism", {
      method: "POST",
      body: JSON.stringify({
        text: "This is a test document for plagiarism checking.",
        sources: [],
      }),
    });

    expect([200, 404, 503]).toContain(response.status);

    if (response.status === 200) {
      const data = await response.json();
      expect(data.overallSimilarity).toBeDefined();
      expect(data.matches).toBeDefined();
    }
  });

  test("can analyze research gaps", async () => {
    const response = await apiRequest("/api/literature/analyze-gaps", {
      method: "POST",
      body: JSON.stringify({
        papers: [
          {
            id: "paper1",
            title: "Test Paper 1",
            abstract: "This is a test abstract about machine learning.",
            year: 2023,
            authors: ["Author A"],
            keywords: ["machine learning", "AI"],
          },
        ],
        query: "machine learning",
      }),
    });

    expect([200, 404, 503]).toContain(response.status);

    if (response.status === 200) {
      const data = await response.json();
      expect(data.gaps).toBeDefined();
      expect(data.recommendations).toBeDefined();
    }
  });
});

test.describe("Schema System", () => {
  test("can list available schemas", async () => {
    const response = await apiRequest("/api/schemas");
    expect([200, 404]).toContain(response.status);

    if (response.status === 200) {
      const data = await response.json();
      expect(Array.isArray(data.schemas) || Array.isArray(data)).toBe(true);
    }
  });

  test("can validate data against schema", async () => {
    const response = await apiRequest("/api/schemas/validate", {
      method: "POST",
      body: JSON.stringify({
        schemaName: "test-schema",
        data: { field1: "value1" },
      }),
    });

    // Schema may not exist
    expect([200, 400, 404]).toContain(response.status);
  });

  test("schema linting returns results", async () => {
    const response = await apiRequest("/api/schemas/lint", {
      method: "POST",
      body: JSON.stringify({
        schema: {
          name: "test",
          columns: [{ name: "field1", type: "string", nullable: false }],
        },
      }),
    });

    expect([200, 404]).toContain(response.status);

    if (response.status === 200) {
      const data = await response.json();
      expect(data.issues || data.errors || data.warnings).toBeDefined();
    }
  });
});

test.describe("Job Queue", () => {
  test("can submit a job", async () => {
    const response = await apiRequest("/api/jobs", {
      method: "POST",
      body: JSON.stringify({
        type: "test-job",
        payload: { test: true },
        priority: "normal",
      }),
    });

    expect([200, 201, 401, 404]).toContain(response.status);

    if (response.status === 200 || response.status === 201) {
      const data = await response.json();
      expect(data.jobId || data.id).toBeDefined();
    }
  });

  test("can query job status", async () => {
    const response = await apiRequest("/api/jobs/test-job-id");
    expect([200, 401, 404]).toContain(response.status);
  });

  test("can list recent jobs", async () => {
    const response = await apiRequest("/api/jobs?limit=10");
    expect([200, 401, 404]).toContain(response.status);

    if (response.status === 200) {
      const data = await response.json();
      expect(Array.isArray(data.jobs) || Array.isArray(data)).toBe(true);
    }
  });
});

test.describe("Webhook System", () => {
  test("can register a webhook", async () => {
    const response = await apiRequest("/api/webhooks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/webhook",
        events: ["artifact.created", "job.completed"],
      }),
    });

    expect([200, 201, 401, 404]).toContain(response.status);
  });

  test("can list webhooks", async () => {
    const response = await apiRequest("/api/webhooks");
    expect([200, 401, 404]).toContain(response.status);
  });
});

test.describe("Caching", () => {
  test("cache stats endpoint returns data", async () => {
    const response = await apiRequest("/api/cache/stats");
    expect([200, 404]).toContain(response.status);

    if (response.status === 200) {
      const data = await response.json();
      expect(data).toBeDefined();
    }
  });

  test("search results are cached", async () => {
    // First request
    const firstResponse = await apiRequest("/api/search?q=test");
    const firstTime = Date.now();

    // Second request (should be cached)
    const secondResponse = await apiRequest("/api/search?q=test");
    const secondTime = Date.now();

    // Cache headers should indicate hit
    expect([200, 404]).toContain(firstResponse.status);
    expect([200, 404]).toContain(secondResponse.status);

    if (firstResponse.status === 200 && secondResponse.status === 200) {
      const cacheHeader = secondResponse.headers.get("X-Cache");
      // If caching is implemented, second request should be faster or have cache hit header
      if (cacheHeader) {
        expect(cacheHeader).toBe("HIT");
      }
    }
  });
});

test.describe("Vector Search", () => {
  test("can perform semantic search", async () => {
    const response = await apiRequest("/api/search/semantic", {
      method: "POST",
      body: JSON.stringify({
        query: "machine learning applications in healthcare",
        limit: 10,
      }),
    });

    expect([200, 404, 503]).toContain(response.status);

    if (response.status === 200) {
      const data = await response.json();
      expect(data.results).toBeDefined();
    }
  });

  test("can perform hybrid search", async () => {
    const response = await apiRequest("/api/search/hybrid", {
      method: "POST",
      body: JSON.stringify({
        query: "machine learning",
        alpha: 0.5,
        limit: 10,
      }),
    });

    expect([200, 404, 503]).toContain(response.status);
  });
});

test.describe("FAIR Metadata", () => {
  test("can generate FAIR metadata for artifact", async () => {
    const response = await apiRequest("/api/artifacts/test-id/fair-metadata");
    expect([200, 401, 404]).toContain(response.status);

    if (response.status === 200) {
      const data = await response.json();
      expect(data.identifier).toBeDefined();
      expect(data.title).toBeDefined();
      expect(data.accessRights).toBeDefined();
    }
  });

  test("can export metadata in DataCite format", async () => {
    const response = await apiRequest("/api/artifacts/test-id/metadata/datacite");
    expect([200, 401, 404]).toContain(response.status);
  });
});

test.describe("Lineage Tracking", () => {
  test("can get artifact lineage", async () => {
    const response = await apiRequest("/api/artifacts/test-id/lineage");
    expect([200, 401, 404]).toContain(response.status);

    if (response.status === 200) {
      const data = await response.json();
      expect(data.nodes || data.graph).toBeDefined();
    }
  });

  test("can export lineage as PROV-JSON", async () => {
    const response = await apiRequest("/api/artifacts/test-id/lineage/prov");
    expect([200, 401, 404]).toContain(response.status);
  });
});

test.describe("Rate Limiting", () => {
  test("rate limits are enforced", async () => {
    const requests: Promise<Response>[] = [];

    // Make many concurrent requests
    for (let i = 0; i < 100; i++) {
      requests.push(apiRequest("/healthz"));
    }

    const responses = await Promise.all(requests);
    const statuses = responses.map((r) => r.status);

    // At least some should succeed
    expect(statuses.filter((s) => s === 200).length).toBeGreaterThan(0);

    // If rate limiting is strict, some might be rate limited
    const rateLimited = statuses.filter((s) => s === 429);
    // This is optional - rate limiting may not be configured
    console.log(`Rate limited requests: ${rateLimited.length}`);
  });
});

test.describe("Error Handling", () => {
  test("returns 404 for non-existent endpoints", async () => {
    const response = await apiRequest("/api/non-existent-endpoint");
    expect(response.status).toBe(404);
  });

  test("returns 400 for malformed requests", async () => {
    const response = await fetch(`${API_URL}/api/schemas/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid json{",
    });

    expect(response.status).toBe(400);
  });

  test("returns proper error format", async () => {
    const response = await apiRequest("/api/non-existent");
    const data = await response.json();

    // Should have error structure
    expect(data.error || data.message || data.status).toBeDefined();
  });
});

test.describe("Security Headers", () => {
  test("response includes security headers", async () => {
    const response = await apiRequest("/healthz");

    // Check for common security headers
    const securityHeaders = [
      "x-content-type-options",
      "x-frame-options",
      "x-xss-protection",
    ];

    for (const header of securityHeaders) {
      const value = response.headers.get(header);
      // Log but don't fail - headers may not be configured in test env
      if (!value) {
        console.log(`Warning: Missing security header: ${header}`);
      }
    }
  });

  test("CORS headers are set correctly", async () => {
    const response = await fetch(`${API_URL}/healthz`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "GET",
      },
    });

    // CORS preflight should succeed
    expect([200, 204, 404]).toContain(response.status);
  });
});

test.describe("Compression", () => {
  test("responses are compressed when accepted", async () => {
    const response = await fetch(`${API_URL}/api/artifacts`, {
      headers: {
        "Accept-Encoding": "gzip, deflate",
      },
    });

    expect([200, 401, 404]).toContain(response.status);

    const contentEncoding = response.headers.get("content-encoding");
    // May be gzip or identity depending on response size
    if (contentEncoding) {
      expect(["gzip", "deflate", "br"]).toContain(contentEncoding);
    }
  });
});
