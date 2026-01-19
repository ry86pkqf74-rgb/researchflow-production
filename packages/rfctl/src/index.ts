#!/usr/bin/env node
/**
 * ResearchFlow CLI (rfctl)
 * Task 164: CLI tool for power users
 */

import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';

const program = new Command();
const BASE_URL = process.env.RF_API_BASE_URL || 'http://localhost:3001';
const API_TOKEN = process.env.RF_API_TOKEN || '';

interface FetchOptions extends RequestInit {
  timeout?: number;
}

async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { timeout = 30000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(API_TOKEN && { Authorization: `Bearer ${API_TOKEN}` }),
      ...(fetchOptions.headers as Record<string, string>),
    };

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error (${response.status}): ${error}`);
    }

    return response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  }
}

function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function log(message: string): void {
  console.log(message);
}

function error(message: string): void {
  console.error(`Error: ${message}`);
  process.exit(1);
}

// Configure CLI
program
  .name('rfctl')
  .description('ResearchFlow CLI - Power user interface')
  .version('0.1.0');

// Health check
program
  .command('health')
  .description('Check API health status')
  .action(async () => {
    try {
      const data = await apiFetch('/healthz');
      log(formatJson(data));
    } catch (e: any) {
      error(e.message);
    }
  });

// Jobs commands
const jobs = program.command('jobs').description('Job management');

jobs
  .command('list')
  .description('List recent jobs')
  .option('-l, --limit <n>', 'Number of jobs to list', '10')
  .option('-s, --status <status>', 'Filter by status')
  .action(async (opts) => {
    try {
      const params = new URLSearchParams();
      if (opts.limit) params.set('limit', opts.limit);
      if (opts.status) params.set('status', opts.status);

      const data = await apiFetch(`/api/jobs?${params}`);
      log(formatJson(data));
    } catch (e: any) {
      error(e.message);
    }
  });

jobs
  .command('submit')
  .description('Submit a new job')
  .requiredOption('--spec <file>', 'Job specification JSON file')
  .action(async (opts) => {
    try {
      const specPath = path.resolve(opts.spec);
      if (!fs.existsSync(specPath)) {
        error(`File not found: ${specPath}`);
      }

      const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
      const data = await apiFetch('/api/jobs', {
        method: 'POST',
        body: JSON.stringify(spec),
      });
      log(formatJson(data));
    } catch (e: any) {
      error(e.message);
    }
  });

jobs
  .command('status <jobId>')
  .description('Get job status')
  .action(async (jobId) => {
    try {
      const data = await apiFetch(`/api/jobs/${jobId}`);
      log(formatJson(data));
    } catch (e: any) {
      error(e.message);
    }
  });

jobs
  .command('cancel <jobId>')
  .description('Cancel a running job')
  .action(async (jobId) => {
    try {
      const data = await apiFetch(`/api/jobs/${jobId}/cancel`, {
        method: 'POST',
      });
      log(formatJson(data));
    } catch (e: any) {
      error(e.message);
    }
  });

// Artifacts commands
const artifacts = program.command('artifacts').description('Artifact management');

artifacts
  .command('list')
  .description('List artifacts')
  .option('-r, --research <id>', 'Filter by research project ID')
  .option('-t, --type <type>', 'Filter by artifact type')
  .action(async (opts) => {
    try {
      const params = new URLSearchParams();
      if (opts.research) params.set('researchId', opts.research);
      if (opts.type) params.set('type', opts.type);

      const data = await apiFetch(`/api/artifacts?${params}`);
      log(formatJson(data));
    } catch (e: any) {
      error(e.message);
    }
  });

artifacts
  .command('get <artifactId>')
  .description('Get artifact details')
  .action(async (artifactId) => {
    try {
      const data = await apiFetch(`/api/artifacts/${artifactId}`);
      log(formatJson(data));
    } catch (e: any) {
      error(e.message);
    }
  });

artifacts
  .command('download <artifactId>')
  .description('Download artifact')
  .requiredOption('-o, --out <file>', 'Output file path')
  .action(async (artifactId, opts) => {
    try {
      const response = await fetch(`${BASE_URL}/api/artifacts/${artifactId}/download`, {
        headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {},
      });

      if (!response.ok) {
        error(`Download failed: ${response.status} ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      fs.writeFileSync(opts.out, Buffer.from(buffer));
      log(`Downloaded to: ${opts.out}`);
    } catch (e: any) {
      error(e.message);
    }
  });

// Pipeline commands
const pipeline = program.command('pipeline').description('Pipeline operations');

pipeline
  .command('runs')
  .description('List pipeline runs')
  .option('-l, --limit <n>', 'Number of runs to list', '10')
  .action(async (opts) => {
    try {
      const data = await apiFetch(`/api/pipeline/runs?limit=${opts.limit}`);
      log(formatJson(data));
    } catch (e: any) {
      error(e.message);
    }
  });

pipeline
  .command('status')
  .description('Get pipeline status')
  .action(async () => {
    try {
      const data = await apiFetch('/api/pipeline/status');
      log(formatJson(data));
    } catch (e: any) {
      error(e.message);
    }
  });

// Governance commands
const governance = program.command('governance').description('Governance operations');

governance
  .command('status')
  .description('Get governance status')
  .action(async () => {
    try {
      const data = await apiFetch('/api/governance/status');
      log(formatJson(data));
    } catch (e: any) {
      error(e.message);
    }
  });

governance
  .command('audit')
  .description('List audit events')
  .option('-l, --limit <n>', 'Number of events', '50')
  .action(async (opts) => {
    try {
      const data = await apiFetch(`/api/governance/audit?limit=${opts.limit}`);
      log(formatJson(data));
    } catch (e: any) {
      error(e.message);
    }
  });

// Config command
program
  .command('config')
  .description('Show current configuration')
  .action(() => {
    log(
      formatJson({
        baseUrl: BASE_URL,
        hasToken: !!API_TOKEN,
      })
    );
  });

program.parse();
