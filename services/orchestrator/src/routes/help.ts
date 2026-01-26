/**
 * Help Routes
 * Task 136 - Interactive API docs using Swagger
 * Task 140 - Community forum links in UI
 * Task 147 - Open-source contribution guides in UI
 */

import { Router, Request, Response } from 'express';
import { generateOpenApiSpec } from '../services/openApiService';
import {
  listCommunityLinks,
  getCommunityLink,
  listContributionGuides,
  getContributionGuide,
  listContributors,
  getFooterSections,
  getHelpCenterConfig,
} from '../services/communityService';

export const helpRouter = Router();

// ─────────────────────────────────────────────────────────────
// OpenAPI / Swagger Endpoints (Task 136)
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/help/openapi.json
 * Returns the OpenAPI specification as JSON
 */
helpRouter.get('/openapi.json', (_req: Request, res: Response) => {
  try {
    const spec = generateOpenApiSpec();
    res.json(spec);
  } catch (error) {
    console.error('Error generating OpenAPI spec:', error);
    res.status(500).json({ error: 'Failed to generate OpenAPI specification' });
  }
});

/**
 * GET /api/help/openapi.yaml
 * Returns the OpenAPI specification as YAML
 */
helpRouter.get('/openapi.yaml', (_req: Request, res: Response) => {
  try {
    const spec = generateOpenApiSpec();
    // Simple JSON to YAML conversion (basic)
    const yaml = jsonToYaml(spec);
    res.type('text/yaml').send(yaml);
  } catch (error) {
    console.error('Error generating OpenAPI spec:', error);
    res.status(500).json({ error: 'Failed to generate OpenAPI specification' });
  }
});

/**
 * GET /api/help/api
 * Serves the Swagger UI HTML page
 */
helpRouter.get('/api', (_req: Request, res: Response) => {
  const swaggerHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ResearchFlow API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; padding: 0; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .info .title { font-size: 2em; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/help/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        validatorUrl: null,
        supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
        docExpansion: 'list',
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
      });
    };
  </script>
</body>
</html>
  `.trim();

  res.type('text/html').send(swaggerHtml);
});

// ─────────────────────────────────────────────────────────────
// Community Links Endpoints (Task 140)
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/help/community
 * List all community links
 */
helpRouter.get('/community', (req: Request, res: Response) => {
  try {
    const type = req.query.type as string | undefined;
    const links = listCommunityLinks({
      type: type as any,
      enabledOnly: true,
    });
    res.json(links);
  } catch (error) {
    console.error('Error listing community links:', error);
    res.status(500).json({ error: 'Failed to list community links' });
  }
});

/**
 * GET /api/help/community/:id
 * Get a specific community link
 */
helpRouter.get('/community/:id', (req: Request, res: Response) => {
  try {
    const link = getCommunityLink(req.params.id);
    if (!link) {
      return res.status(404).json({ error: 'Community link not found' });
    }
    res.json(link);
  } catch (error) {
    console.error('Error getting community link:', error);
    res.status(500).json({ error: 'Failed to get community link' });
  }
});

/**
 * GET /api/help/footer
 * Get footer sections for UI
 */
helpRouter.get('/footer', (_req: Request, res: Response) => {
  try {
    const sections = getFooterSections();
    res.json(sections);
  } catch (error) {
    console.error('Error getting footer sections:', error);
    res.status(500).json({ error: 'Failed to get footer sections' });
  }
});

// ─────────────────────────────────────────────────────────────
// Contribution Guides Endpoints (Task 147)
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/help/contributing
 * List all contribution guides
 */
helpRouter.get('/contributing', (req: Request, res: Response) => {
  try {
    const type = req.query.type as string | undefined;
    const guides = listContributionGuides({
      type: type as any,
    });

    // Return summary without full content
    const summaries = guides.map(g => ({
      id: g.id,
      type: g.type,
      title: g.title,
      slug: g.slug,
      order: g.order,
      lastUpdated: g.lastUpdated,
    }));

    res.json(summaries);
  } catch (error) {
    console.error('Error listing contribution guides:', error);
    res.status(500).json({ error: 'Failed to list contribution guides' });
  }
});

/**
 * GET /api/help/contributing/:slug
 * Get a specific contribution guide by slug
 */
helpRouter.get('/contributing/:slug', (req: Request, res: Response) => {
  try {
    const guide = getContributionGuide(req.params.slug);
    if (!guide) {
      return res.status(404).json({ error: 'Contribution guide not found' });
    }
    res.json(guide);
  } catch (error) {
    console.error('Error getting contribution guide:', error);
    res.status(500).json({ error: 'Failed to get contribution guide' });
  }
});

/**
 * GET /api/help/contributors
 * List top contributors
 */
helpRouter.get('/contributors', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const sortBy = (req.query.sortBy as 'contributions' | 'recent') || 'contributions';

    const contributors = listContributors({ limit, sortBy });
    res.json(contributors);
  } catch (error) {
    console.error('Error listing contributors:', error);
    res.status(500).json({ error: 'Failed to list contributors' });
  }
});

// ─────────────────────────────────────────────────────────────
// Help Center Config Endpoint
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/help/config
 * Get help center configuration for UI
 */
helpRouter.get('/config', (_req: Request, res: Response) => {
  try {
    const config = getHelpCenterConfig();
    res.json(config);
  } catch (error) {
    console.error('Error getting help center config:', error);
    res.status(500).json({ error: 'Failed to get help center configuration' });
  }
});

// ─────────────────────────────────────────────────────────────
// Static Documentation Endpoints
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/help/docs/:name
 * Serve static documentation files (CONTRIBUTING.md, etc.)
 */
helpRouter.get('/docs/:name', (req: Request, res: Response) => {
  const docName = req.params.name.toLowerCase().replace(/\.md$/, '');

  // Map doc names to contribution guide types
  const docMap: Record<string, string> = {
    'contributing': 'contributing',
    'code-of-conduct': 'code-of-conduct',
    'security': 'security',
    'getting-started': 'getting-started',
    'development': 'development',
    'architecture': 'architecture',
  };

  const slug = docMap[docName];
  if (!slug) {
    return res.status(404).json({ error: 'Documentation not found' });
  }

  const guide = getContributionGuide(slug);
  if (!guide) {
    return res.status(404).json({ error: 'Documentation not found' });
  }

  // Return as markdown
  res.type('text/markdown').send(guide.content);
});

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Simple JSON to YAML converter
 * For production, use a proper yaml library
 */
function jsonToYaml(obj: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent);

  if (obj === null || obj === undefined) {
    return 'null';
  }

  if (typeof obj === 'string') {
    // Quote strings with special chars
    if (obj.includes('\n') || obj.includes(':') || obj.includes('#')) {
      return `|\n${obj.split('\n').map(line => spaces + '  ' + line).join('\n')}`;
    }
    return obj.includes(':') || obj.includes('"') ? `"${obj.replace(/"/g, '\\"')}"` : obj;
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj.map(item => {
      const itemYaml = jsonToYaml(item, indent + 1);
      const isComplex = typeof item === 'object' && item !== null;
      return isComplex
        ? `${spaces}- ${itemYaml.trim().replace(/^\s+/, '')}`
        : `${spaces}- ${itemYaml}`;
    }).join('\n');
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj);
    if (entries.length === 0) return '{}';
    return entries.map(([key, value]) => {
      const valueYaml = jsonToYaml(value, indent + 1);
      const isComplex = typeof value === 'object' && value !== null && !Array.isArray(value);
      return isComplex
        ? `${spaces}${key}:\n${valueYaml}`
        : `${spaces}${key}: ${valueYaml}`;
    }).join('\n');
  }

  return String(obj);
}

export default helpRouter;
