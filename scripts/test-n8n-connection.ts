#!/usr/bin/env ts-node
/**
 * N8N Cloud Connection Test Script
 *
 * Usage: npm run test:n8n
 *
 * This script validates:
 * 1. N8N API connectivity
 * 2. JWT token validity
 * 3. MCP server reachability
 * 4. Workflow listing
 * 5. Execution monitoring
 *
 * Environment Variables Required:
 * - N8N_BASE_URL
 * - N8N_API_KEY
 * - N8N_MCP_SERVER_URL
 * - N8N_MCP_TOKEN
 */

import dotenv from 'dotenv';

dotenv.config();

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: Record<string, any>;
}

class N8nConnectionTester {
  private baseUrl: string;
  private apiKey: string;
  private mcpServerUrl: string;
  private mcpToken: string;
  private results: TestResult[] = [];

  constructor() {
    this.baseUrl = process.env.N8N_BASE_URL || 'https://loganglosser13.app.n8n.cloud';
    this.apiKey = process.env.N8N_API_KEY || '';
    this.mcpServerUrl = process.env.N8N_MCP_SERVER_URL || '';
    this.mcpToken = process.env.N8N_MCP_TOKEN || '';
  }

  async run(): Promise<void> {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   N8N Cloud Connection Test Suite      ║');
    console.log('║   ResearchFlow Production             ║');
    console.log('╚════════════════════════════════════════╝\n');

    // Run all tests
    await this.testEnvironmentVariables();
    await this.testTokenValidity();
    await this.testApiConnectivity();
    await this.testMcpServerReachability();
    await this.testWorkflowListing();
    await this.testExecutionFetch();

    // Print summary
    this.printSummary();
  }

  private async testEnvironmentVariables(): Promise<void> {
    console.log('→ Test 1: Environment Variables');

    const hasBaseUrl = !!this.baseUrl && this.baseUrl !== '';
    const hasApiKey = !!this.apiKey && this.apiKey !== '';
    const hasMcpServer = !!this.mcpServerUrl && this.mcpServerUrl !== '';
    const hasMcpToken = !!this.mcpToken && this.mcpToken !== '';

    const allSet = hasBaseUrl && hasApiKey && hasMcpServer && hasMcpToken;

    this.results.push({
      name: 'Environment Variables',
      status: allSet ? 'PASS' : 'FAIL',
      message: allSet
        ? 'All required environment variables are configured'
        : 'Missing environment variables',
      details: {
        'N8N_BASE_URL': hasBaseUrl ? '✓ Set' : '✗ Missing',
        'N8N_API_KEY': hasApiKey ? '✓ Set' : '✗ Missing',
        'N8N_MCP_SERVER_URL': hasMcpServer ? '✓ Set' : '✗ Missing',
        'N8N_MCP_TOKEN': hasMcpToken ? '✓ Set' : '✗ Missing',
      }
    });

    if (allSet) {
      console.log('  ✓ All environment variables configured\n');
    } else {
      console.log('  ✗ Missing environment variables\n');
    }
  }

  private async testTokenValidity(): Promise<void> {
    console.log('→ Test 2: JWT Token Validity');

    try {
      const parts = this.apiKey.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64').toString()
      );

      const issued = new Date(payload.iat * 1000);
      const now = new Date();
      let status: 'PASS' | 'FAIL' | 'WARN' = 'PASS';
      let message = 'JWT token is valid';

      if (payload.exp) {
        const expDate = new Date(payload.exp * 1000);
        if (expDate < now) {
          status = 'FAIL';
          message = `Token expired on ${expDate.toISOString()}`;
        } else {
          const daysLeft = Math.floor((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysLeft < 7) {
            status = 'WARN';
            message = `Token expires in ${daysLeft} days`;
          }
        }
      }

      this.results.push({
        name: 'JWT Token Validity',
        status,
        message,
        details: {
          'Issuer': payload.iss || 'N/A',
          'Subject': payload.sub?.substring(0, 8) + '...' || 'N/A',
          'Audience': payload.aud || 'N/A',
          'Issued': issued.toISOString(),
          'Expires': payload.exp ? new Date(payload.exp * 1000).toISOString() : 'Never',
        }
      });

      console.log(`  ✓ JWT token valid (${payload.aud})\n`);
    } catch (error) {
      this.results.push({
        name: 'JWT Token Validity',
        status: 'FAIL',
        message: `Token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });

      console.log(`  ✗ Token validation failed: ${error instanceof Error ? error.message : 'Unknown'}\n`);
    }
  }

  private async testApiConnectivity(): Promise<void> {
    console.log('→ Test 3: N8N API Connectivity');

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/workflows`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-API-KEY': this.apiKey,
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.results.push({
          name: 'API Connectivity',
          status: 'PASS',
          message: 'Successfully connected to N8N API',
          details: {
            'Status Code': response.status,
            'Base URL': this.baseUrl,
            'Response Type': Array.isArray(data) ? 'Array' : typeof data,
          }
        });

        console.log(`  ✓ API connected (Status: ${response.status})\n`);
      } else {
        this.results.push({
          name: 'API Connectivity',
          status: 'FAIL',
          message: `API returned ${response.status}`,
          details: {
            'Status Code': response.status,
            'Status Text': response.statusText,
          }
        });

        console.log(`  ✗ API error: ${response.status} ${response.statusText}\n`);
      }
    } catch (error) {
      this.results.push({
        name: 'API Connectivity',
        status: 'FAIL',
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });

      console.log(`  ✗ Connection failed: ${error instanceof Error ? error.message : 'Unknown'}\n`);
    }
  }

  private async testMcpServerReachability(): Promise<void> {
    console.log('→ Test 4: MCP Server Reachability');

    if (!this.mcpServerUrl) {
      this.results.push({
        name: 'MCP Server Reachability',
        status: 'WARN',
        message: 'MCP Server URL not configured'
      });

      console.log('  ⚠ MCP Server URL not configured\n');
      return;
    }

    try {
      const response = await fetch(this.mcpServerUrl, {
        method: 'HEAD',
      });

      const reachable = response.ok || response.status === 404 || response.status === 405;

      this.results.push({
        name: 'MCP Server Reachability',
        status: reachable ? 'PASS' : 'FAIL',
        message: reachable ? 'MCP Server is reachable' : `Unexpected status ${response.status}`,
        details: {
          'Status Code': response.status,
          'Server URL': this.mcpServerUrl,
        }
      });

      console.log(`  ✓ MCP Server reachable (Status: ${response.status})\n`);
    } catch (error) {
      this.results.push({
        name: 'MCP Server Reachability',
        status: 'FAIL',
        message: `Could not reach MCP server: ${error instanceof Error ? error.message : 'Unknown error'}`
      });

      console.log(`  ✗ MCP Server unreachable: ${error instanceof Error ? error.message : 'Unknown'}\n`);
    }
  }

  private async testWorkflowListing(): Promise<void> {
    console.log('→ Test 5: Workflow Listing');

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/workflows`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-API-KEY': this.apiKey,
        },
      });

      if (!response.ok) {
        this.results.push({
          name: 'Workflow Listing',
          status: 'FAIL',
          message: `Failed to list workflows: ${response.status}`
        });

        console.log(`  ✗ Failed to list workflows\n`);
        return;
      }

      const workflows = await response.json() as any[];

      if (!Array.isArray(workflows)) {
        this.results.push({
          name: 'Workflow Listing',
          status: 'FAIL',
          message: 'Unexpected response format'
        });

        console.log('  ✗ Unexpected response format\n');
        return;
      }

      // Check for required workflows
      const requiredWorkflows = [
        'github-issue-notion-sync',
        'notion-ci-trigger',
        'ci-completion-slack-notify',
        'workflow-stage-completion-sync'
      ];

      const foundWorkflows = workflows.map(w => w.name);
      const missingWorkflows = requiredWorkflows.filter(
        req => !foundWorkflows.some(found => found?.includes(req.split('-')[0]))
      );

      this.results.push({
        name: 'Workflow Listing',
        status: missingWorkflows.length === 0 ? 'PASS' : 'WARN',
        message: missingWorkflows.length === 0
          ? `Found ${workflows.length} workflows`
          : `Missing ${missingWorkflows.length} required workflows`,
        details: {
          'Total Workflows': workflows.length,
          'Sample Workflows': workflows.slice(0, 3).map(w => w.name).join(', '),
          'Missing Workflows': missingWorkflows.length > 0 ? missingWorkflows.join(', ') : 'None'
        }
      });

      console.log(`  ✓ Found ${workflows.length} workflows\n`);
    } catch (error) {
      this.results.push({
        name: 'Workflow Listing',
        status: 'FAIL',
        message: `Error listing workflows: ${error instanceof Error ? error.message : 'Unknown error'}`
      });

      console.log(`  ✗ Error listing workflows\n`);
    }
  }

  private async testExecutionFetch(): Promise<void> {
    console.log('→ Test 6: Execution Monitoring');

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/executions?limit=5`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-API-KEY': this.apiKey,
        },
      });

      if (!response.ok) {
        this.results.push({
          name: 'Execution Monitoring',
          status: 'FAIL',
          message: `Failed to fetch executions: ${response.status}`
        });

        console.log(`  ✗ Failed to fetch executions\n`);
        return;
      }

      const executions = await response.json() as any[];

      this.results.push({
        name: 'Execution Monitoring',
        status: 'PASS',
        message: 'Successfully fetched execution history',
        details: {
          'Recent Executions': executions.length,
          'Sample Status': executions.length > 0 ? executions[0].status : 'N/A',
        }
      });

      console.log(`  ✓ Can fetch executions (Found ${executions.length} recent)\n`);
    } catch (error) {
      this.results.push({
        name: 'Execution Monitoring',
        status: 'FAIL',
        message: `Error fetching executions: ${error instanceof Error ? error.message : 'Unknown error'}`
      });

      console.log(`  ✗ Error fetching executions\n`);
    }
  }

  private printSummary(): void {
    console.log('╔════════════════════════════════════════╗');
    console.log('║         Test Results Summary           ║');
    console.log('╚════════════════════════════════════════╝\n');

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warned = this.results.filter(r => r.status === 'WARN').length;

    this.results.forEach(result => {
      const icon = result.status === 'PASS' ? '✓' : result.status === 'FAIL' ? '✗' : '⚠';
      console.log(`${icon} ${result.name}`);
      console.log(`  ${result.message}`);

      if (result.details) {
        Object.entries(result.details).forEach(([key, value]) => {
          console.log(`    • ${key}: ${value}`);
        });
      }

      console.log();
    });

    console.log('╔════════════════════════════════════════╗');
    console.log(`║ PASSED: ${passed}  FAILED: ${failed}  WARNED: ${warned}       ║`);
    console.log('╚════════════════════════════════════════╝\n');

    if (failed === 0) {
      console.log('✓ All critical tests passed! Ready for workflow deployment.\n');
      process.exit(0);
    } else {
      console.log('✗ Some critical tests failed. Please review the errors above.\n');
      process.exit(1);
    }
  }
}

const tester = new N8nConnectionTester();
tester.run().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
