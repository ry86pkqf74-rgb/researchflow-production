/**
 * Community Service
 * Task 140 - Community forum links in UI
 * Task 147 - Open-source contribution guides in UI
 *
 * Manages community resources, forum links, and contribution guides
 */

import { z } from 'zod';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────
// Types & Schemas
// ─────────────────────────────────────────────────────────────

export const CommunityLinkTypeSchema = z.enum([
  'FORUM',
  'ISSUES',
  'DISCUSSIONS',
  'WIKI',
  'DOCS',
  'CHAT',
  'SOCIAL',
  'SUPPORT',
]);

export const CommunityLinkSchema = z.object({
  id: z.string(),
  type: CommunityLinkTypeSchema,
  label: z.string(),
  description: z.string().optional(),
  url: z.string().url(),
  icon: z.string().optional(), // Icon identifier (e.g., 'github', 'discord', 'slack')
  external: z.boolean().default(true),
  order: z.number().int().default(0),
  enabled: z.boolean().default(true),
});

export const ContributionGuideTypeSchema = z.enum([
  'GETTING_STARTED',
  'CODE_OF_CONDUCT',
  'CONTRIBUTING',
  'SECURITY',
  'DEVELOPMENT',
  'ARCHITECTURE',
  'API',
  'TESTING',
]);

export const ContributionGuideSchema = z.object({
  id: z.string(),
  type: ContributionGuideTypeSchema,
  title: z.string(),
  slug: z.string(),
  content: z.string(), // Markdown content
  order: z.number().int().default(0),
  lastUpdated: z.string().datetime(),
});

export const ContributorSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  profileUrl: z.string().url().optional(),
  contributions: z.number().int().default(0),
  firstContributionAt: z.string().datetime().optional(),
  badges: z.array(z.string()).default([]),
});

export type CommunityLinkType = z.infer<typeof CommunityLinkTypeSchema>;
export type CommunityLink = z.infer<typeof CommunityLinkSchema>;
export type ContributionGuideType = z.infer<typeof ContributionGuideTypeSchema>;
export type ContributionGuide = z.infer<typeof ContributionGuideSchema>;
export type Contributor = z.infer<typeof ContributorSchema>;

// ─────────────────────────────────────────────────────────────
// In-Memory Storage (would be DB in production)
// ─────────────────────────────────────────────────────────────

const communityLinks: Map<string, CommunityLink> = new Map();
const contributionGuides: Map<string, ContributionGuide> = new Map();
const contributors: Map<string, Contributor> = new Map();

// ─────────────────────────────────────────────────────────────
// Default Community Links
// ─────────────────────────────────────────────────────────────

const DEFAULT_COMMUNITY_LINKS: Omit<CommunityLink, 'id'>[] = [
  {
    type: 'DISCUSSIONS',
    label: 'Community Forum',
    description: 'Ask questions, share ideas, and connect with other researchers',
    url: 'https://github.com/ry86pkqf74-rgb/researchflow-production/discussions',
    icon: 'message-circle',
    external: true,
    order: 1,
    enabled: true,
  },
  {
    type: 'ISSUES',
    label: 'Report a Bug',
    description: 'Found an issue? Let us know so we can fix it',
    url: 'https://github.com/ry86pkqf74-rgb/researchflow-production/issues/new?template=bug_report.md',
    icon: 'bug',
    external: true,
    order: 2,
    enabled: true,
  },
  {
    type: 'ISSUES',
    label: 'Request a Feature',
    description: 'Have an idea for a new feature? We\'d love to hear it',
    url: 'https://github.com/ry86pkqf74-rgb/researchflow-production/issues/new?template=feature_request.md',
    icon: 'lightbulb',
    external: true,
    order: 3,
    enabled: true,
  },
  {
    type: 'DOCS',
    label: 'Documentation',
    description: 'Comprehensive guides and API documentation',
    url: '/help',
    icon: 'book-open',
    external: false,
    order: 4,
    enabled: true,
  },
  {
    type: 'WIKI',
    label: 'Knowledge Base',
    description: 'Community-maintained wiki with tutorials and best practices',
    url: 'https://github.com/ry86pkqf74-rgb/researchflow-production/wiki',
    icon: 'library',
    external: true,
    order: 5,
    enabled: true,
  },
  {
    type: 'CHAT',
    label: 'Discord Community',
    description: 'Join our Discord server for real-time discussions',
    url: 'https://discord.gg/researchflow',
    icon: 'discord',
    external: true,
    order: 6,
    enabled: true,
  },
  {
    type: 'SOCIAL',
    label: 'Twitter/X',
    description: 'Follow us for updates and announcements',
    url: 'https://twitter.com/researchflow',
    icon: 'twitter',
    external: true,
    order: 7,
    enabled: true,
  },
  {
    type: 'SUPPORT',
    label: 'Contact Support',
    description: 'Get help from our support team',
    url: 'mailto:support@researchflow.io',
    icon: 'mail',
    external: true,
    order: 8,
    enabled: true,
  },
];

// ─────────────────────────────────────────────────────────────
// Default Contribution Guides
// ─────────────────────────────────────────────────────────────

const DEFAULT_CONTRIBUTION_GUIDES: Omit<ContributionGuide, 'id'>[] = [
  {
    type: 'GETTING_STARTED',
    title: 'Getting Started',
    slug: 'getting-started',
    order: 1,
    lastUpdated: new Date().toISOString(),
    content: `
# Getting Started with ResearchFlow Development

Welcome to ResearchFlow! This guide will help you set up your development environment.

## Prerequisites

- Node.js 18 or higher
- PostgreSQL 14 or higher
- Git
- Docker (optional, for containerized development)

## Quick Start

1. **Clone the repository**
   \`\`\`bash
   git clone https://github.com/ry86pkqf74-rgb/researchflow-production.git
   cd researchflow-production
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

3. **Configure environment**
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your local settings
   \`\`\`

4. **Run database migrations**
   \`\`\`bash
   npm run db:migrate
   \`\`\`

5. **Start the development server**
   \`\`\`bash
   npm run dev
   \`\`\`

## Project Structure

\`\`\`
researchflow-production/
├── services/          # Backend services
│   └── orchestrator/  # Main API service
├── packages/          # Shared packages
│   └── web/          # Frontend application
├── migrations/        # Database migrations
├── docs/             # Documentation
└── k8s/              # Kubernetes manifests
\`\`\`

## Next Steps

- Read the [Contributing Guide](./contributing)
- Check out the [Architecture Overview](./architecture)
- Join our [Discord community](https://discord.gg/researchflow)
    `.trim(),
  },
  {
    type: 'CODE_OF_CONDUCT',
    title: 'Code of Conduct',
    slug: 'code-of-conduct',
    order: 2,
    lastUpdated: new Date().toISOString(),
    content: `
# Contributor Covenant Code of Conduct

## Our Pledge

We as members, contributors, and leaders pledge to make participation in our
community a harassment-free experience for everyone, regardless of age, body
size, visible or invisible disability, ethnicity, sex characteristics, gender
identity and expression, level of experience, education, socio-economic status,
nationality, personal appearance, race, religion, or sexual identity
and orientation.

## Our Standards

**Examples of behavior that contributes to a positive environment:**

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Examples of unacceptable behavior:**

- The use of sexualized language or imagery
- Trolling, insulting/derogatory comments, and personal or political attacks
- Public or private harassment
- Publishing others' private information without explicit permission
- Other conduct which could reasonably be considered inappropriate

## Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be
reported to the community leaders responsible for enforcement at
conduct@researchflow.io.

All complaints will be reviewed and investigated promptly and fairly.

## Attribution

This Code of Conduct is adapted from the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).
    `.trim(),
  },
  {
    type: 'CONTRIBUTING',
    title: 'Contributing Guide',
    slug: 'contributing',
    order: 3,
    lastUpdated: new Date().toISOString(),
    content: `
# Contributing to ResearchFlow

Thank you for your interest in contributing to ResearchFlow! This document provides guidelines for contributions.

## Ways to Contribute

- **Report bugs** - File issues for bugs you encounter
- **Suggest features** - Share ideas for new functionality
- **Submit PRs** - Fix bugs or implement new features
- **Improve docs** - Help improve our documentation
- **Answer questions** - Help others in discussions

## Pull Request Process

1. **Fork and clone** the repository
2. **Create a branch** for your changes
   \`\`\`bash
   git checkout -b feature/your-feature-name
   \`\`\`
3. **Make your changes** following our coding standards
4. **Write tests** for new functionality
5. **Run the test suite**
   \`\`\`bash
   npm test
   \`\`\`
6. **Submit a PR** with a clear description

## Coding Standards

- Use TypeScript for all new code
- Follow existing code style (enforced by ESLint)
- Write meaningful commit messages
- Add JSDoc comments for public APIs
- Ensure PHI-safety in all data handling

## Commit Message Format

\`\`\`
type(scope): short description

- Detailed bullet points
- Explaining the changes

Closes #123
\`\`\`

**Types:** feat, fix, docs, style, refactor, test, chore

## Review Process

All PRs require at least one review before merging. Reviewers will check:

- Code quality and style
- Test coverage
- Documentation updates
- PHI-safety compliance
- Performance implications

## Getting Help

- Join our [Discord](https://discord.gg/researchflow)
- Ask in [Discussions](https://github.com/ry86pkqf74-rgb/researchflow-production/discussions)
- Email: contribute@researchflow.io
    `.trim(),
  },
  {
    type: 'SECURITY',
    title: 'Security Policy',
    slug: 'security',
    order: 4,
    lastUpdated: new Date().toISOString(),
    content: `
# Security Policy

## Reporting a Vulnerability

**DO NOT** file a public issue for security vulnerabilities.

Instead, please report them via:
- Email: security@researchflow.io
- Or use GitHub's private vulnerability reporting feature

## What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Response Timeline

- **24 hours**: Initial acknowledgment
- **72 hours**: Preliminary assessment
- **7 days**: Detailed response and remediation plan
- **90 days**: Public disclosure (coordinated)

## Scope

In scope:
- Authentication/authorization flaws
- Data exposure vulnerabilities
- PHI leakage
- Injection attacks
- CSRF/XSS vulnerabilities

Out of scope:
- Social engineering attacks
- Physical security
- Denial of service

## Recognition

We recognize security researchers who help improve our security.
See our [Security Hall of Fame](/security/hall-of-fame).

## PHI-Safety

ResearchFlow handles potentially sensitive research data. Any vulnerability
that could lead to PHI exposure is treated with highest priority.
    `.trim(),
  },
  {
    type: 'DEVELOPMENT',
    title: 'Development Guide',
    slug: 'development',
    order: 5,
    lastUpdated: new Date().toISOString(),
    content: `
# Development Guide

## Environment Setup

### Required Tools
- Node.js 18+
- PostgreSQL 14+
- Redis 7+ (for caching)
- Git

### Optional Tools
- Docker & Docker Compose
- kubectl (for K8s deployment)

## Running Locally

### Using npm
\`\`\`bash
# Install dependencies
npm install

# Start all services
npm run dev

# Start specific service
npm run dev:orchestrator
npm run dev:web
\`\`\`

### Using Docker
\`\`\`bash
docker-compose up -d
\`\`\`

## Testing

\`\`\`bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific tests
npm test -- --grep "workflow"
\`\`\`

## Database

\`\`\`bash
# Run migrations
npm run db:migrate

# Create new migration
npm run db:migrate:create -- migration-name

# Rollback
npm run db:migrate:rollback
\`\`\`

## Code Quality

\`\`\`bash
# Lint
npm run lint

# Format
npm run format

# Type check
npm run typecheck
\`\`\`

## Debugging

- API logs: \`npm run logs:api\`
- Database queries: Set \`DEBUG=knex:query\`
- Frontend: Use React DevTools
    `.trim(),
  },
  {
    type: 'ARCHITECTURE',
    title: 'Architecture Overview',
    slug: 'architecture',
    order: 6,
    lastUpdated: new Date().toISOString(),
    content: `
# Architecture Overview

## System Design

ResearchFlow follows a modular monolith architecture with clear boundaries
between domains.

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                        Web Frontend                          │
│                    (React + TypeScript)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway / BFF                         │
│                      (Express.js)                            │
└─────────────────────────────────────────────────────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       ▼                      ▼                      ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Research   │      │  Workflow   │      │    AI       │
│   Service   │      │   Service   │      │  Service    │
└─────────────┘      └─────────────┘      └─────────────┘
       │                      │                      │
       └──────────────────────┼──────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       PostgreSQL                             │
│                  (Primary Data Store)                        │
└─────────────────────────────────────────────────────────────┘
\`\`\`

## Key Principles

1. **PHI-Safety**: All data handling is PHI-aware
2. **Audit Trail**: Every operation is logged
3. **Tenant Isolation**: Strict multi-tenant boundaries
4. **Immutable History**: Artifacts preserve full history

## Data Flow

1. User action → API endpoint
2. Validation (Zod schemas)
3. Authorization (RBAC)
4. Business logic
5. Audit logging
6. Database operation
7. Response

## Plugin Architecture

Plugins extend functionality through defined hooks:
- Stage extensions
- AI model providers
- Import connectors
- Export integrations
    `.trim(),
  },
];

// ─────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────

function initializeDefaults(): void {
  // Initialize community links
  if (communityLinks.size === 0) {
    for (const link of DEFAULT_COMMUNITY_LINKS) {
      const id = crypto.randomUUID();
      communityLinks.set(id, { id, ...link });
    }
  }

  // Initialize contribution guides
  if (contributionGuides.size === 0) {
    for (const guide of DEFAULT_CONTRIBUTION_GUIDES) {
      const id = crypto.randomUUID();
      contributionGuides.set(id, { id, ...guide });
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Community Links API
// ─────────────────────────────────────────────────────────────

export function listCommunityLinks(options?: {
  type?: CommunityLinkType;
  enabledOnly?: boolean;
}): CommunityLink[] {
  initializeDefaults();

  let links = Array.from(communityLinks.values());

  if (options?.type) {
    links = links.filter(l => l.type === options.type);
  }

  if (options?.enabledOnly !== false) {
    links = links.filter(l => l.enabled);
  }

  return links.sort((a, b) => a.order - b.order);
}

export function getCommunityLink(id: string): CommunityLink | undefined {
  initializeDefaults();
  return communityLinks.get(id);
}

export function createCommunityLink(input: Omit<CommunityLink, 'id'>): CommunityLink {
  const id = crypto.randomUUID();
  const link: CommunityLink = { id, ...input };
  communityLinks.set(id, link);
  return link;
}

export function updateCommunityLink(id: string, updates: Partial<Omit<CommunityLink, 'id'>>): CommunityLink | undefined {
  const existing = communityLinks.get(id);
  if (!existing) return undefined;

  const updated: CommunityLink = { ...existing, ...updates };
  communityLinks.set(id, updated);
  return updated;
}

export function deleteCommunityLink(id: string): boolean {
  return communityLinks.delete(id);
}

// ─────────────────────────────────────────────────────────────
// Contribution Guides API
// ─────────────────────────────────────────────────────────────

export function listContributionGuides(options?: {
  type?: ContributionGuideType;
}): ContributionGuide[] {
  initializeDefaults();

  let guides = Array.from(contributionGuides.values());

  if (options?.type) {
    guides = guides.filter(g => g.type === options.type);
  }

  return guides.sort((a, b) => a.order - b.order);
}

export function getContributionGuide(idOrSlug: string): ContributionGuide | undefined {
  initializeDefaults();

  // Try by ID first
  const byId = contributionGuides.get(idOrSlug);
  if (byId) return byId;

  // Then by slug
  return Array.from(contributionGuides.values()).find(g => g.slug === idOrSlug);
}

export function createContributionGuide(input: Omit<ContributionGuide, 'id'>): ContributionGuide {
  const id = crypto.randomUUID();
  const guide: ContributionGuide = { id, ...input };
  contributionGuides.set(id, guide);
  return guide;
}

export function updateContributionGuide(id: string, updates: Partial<Omit<ContributionGuide, 'id'>>): ContributionGuide | undefined {
  const existing = contributionGuides.get(id);
  if (!existing) return undefined;

  const updated: ContributionGuide = {
    ...existing,
    ...updates,
    lastUpdated: new Date().toISOString(),
  };
  contributionGuides.set(id, updated);
  return updated;
}

export function deleteContributionGuide(id: string): boolean {
  return contributionGuides.delete(id);
}

// ─────────────────────────────────────────────────────────────
// Contributors API
// ─────────────────────────────────────────────────────────────

export function listContributors(options?: {
  limit?: number;
  sortBy?: 'contributions' | 'recent';
}): Contributor[] {
  let contribs = Array.from(contributors.values());

  const sortBy = options?.sortBy ?? 'contributions';
  if (sortBy === 'contributions') {
    contribs.sort((a, b) => b.contributions - a.contributions);
  } else {
    contribs.sort((a, b) => {
      const aDate = a.firstContributionAt ? new Date(a.firstContributionAt).getTime() : 0;
      const bDate = b.firstContributionAt ? new Date(b.firstContributionAt).getTime() : 0;
      return bDate - aDate;
    });
  }

  if (options?.limit) {
    contribs = contribs.slice(0, options.limit);
  }

  return contribs;
}

export function getContributor(id: string): Contributor | undefined {
  return contributors.get(id);
}

export function recordContribution(username: string, metadata?: {
  displayName?: string;
  avatarUrl?: string;
  profileUrl?: string;
}): Contributor {
  const existing = Array.from(contributors.values()).find(c => c.username === username);

  if (existing) {
    const updated: Contributor = {
      ...existing,
      contributions: existing.contributions + 1,
      ...metadata,
    };
    contributors.set(existing.id, updated);
    return updated;
  }

  const id = crypto.randomUUID();
  const contributor: Contributor = {
    id,
    username,
    displayName: metadata?.displayName,
    avatarUrl: metadata?.avatarUrl,
    profileUrl: metadata?.profileUrl,
    contributions: 1,
    firstContributionAt: new Date().toISOString(),
    badges: [],
  };
  contributors.set(id, contributor);
  return contributor;
}

// ─────────────────────────────────────────────────────────────
// Footer Links (for UI consumption)
// ─────────────────────────────────────────────────────────────

export interface FooterSection {
  title: string;
  links: Array<{
    label: string;
    url: string;
    external: boolean;
    icon?: string;
  }>;
}

export function getFooterSections(): FooterSection[] {
  initializeDefaults();

  const links = listCommunityLinks({ enabledOnly: true });

  return [
    {
      title: 'Community',
      links: links
        .filter(l => ['DISCUSSIONS', 'CHAT', 'SOCIAL'].includes(l.type))
        .map(l => ({
          label: l.label,
          url: l.url,
          external: l.external,
          icon: l.icon,
        })),
    },
    {
      title: 'Resources',
      links: links
        .filter(l => ['DOCS', 'WIKI'].includes(l.type))
        .map(l => ({
          label: l.label,
          url: l.url,
          external: l.external,
          icon: l.icon,
        })),
    },
    {
      title: 'Support',
      links: links
        .filter(l => ['ISSUES', 'SUPPORT'].includes(l.type))
        .map(l => ({
          label: l.label,
          url: l.url,
          external: l.external,
          icon: l.icon,
        })),
    },
  ];
}

// ─────────────────────────────────────────────────────────────
// Help Center Config
// ─────────────────────────────────────────────────────────────

export interface HelpCenterConfig {
  sections: Array<{
    id: string;
    title: string;
    description: string;
    icon: string;
    href: string;
  }>;
}

export function getHelpCenterConfig(): HelpCenterConfig {
  return {
    sections: [
      {
        id: 'api-docs',
        title: 'API Documentation',
        description: 'Interactive API reference powered by Swagger/OpenAPI',
        icon: 'code',
        href: '/help/api',
      },
      {
        id: 'guides',
        title: 'User Guides',
        description: 'Step-by-step guides for common tasks',
        icon: 'book-open',
        href: '/help/guides',
      },
      {
        id: 'tutorials',
        title: 'Tutorials',
        description: 'Interactive tutorials with code sandboxes',
        icon: 'graduation-cap',
        href: '/help/tutorials',
      },
      {
        id: 'contributing',
        title: 'Contributing',
        description: 'Learn how to contribute to ResearchFlow',
        icon: 'git-pull-request',
        href: '/help/contributing',
      },
      {
        id: 'community',
        title: 'Community',
        description: 'Connect with other researchers and developers',
        icon: 'users',
        href: '/help/community',
      },
      {
        id: 'faq',
        title: 'FAQ',
        description: 'Frequently asked questions',
        icon: 'help-circle',
        href: '/help/faq',
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

export default {
  // Community Links
  listCommunityLinks,
  getCommunityLink,
  createCommunityLink,
  updateCommunityLink,
  deleteCommunityLink,

  // Contribution Guides
  listContributionGuides,
  getContributionGuide,
  createContributionGuide,
  updateContributionGuide,
  deleteContributionGuide,

  // Contributors
  listContributors,
  getContributor,
  recordContribution,

  // UI Helpers
  getFooterSections,
  getHelpCenterConfig,
};
