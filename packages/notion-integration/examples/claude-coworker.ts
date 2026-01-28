#!/usr/bin/env tsx
/**
 * Claude Coworker Deployment Tracking Example
 * 
 * This example demonstrates how Claude Coworker (or any AI tool) should use
 * the Notion integration for tracking deployment tasks:
 * 
 * 1. Start execution when beginning a task
 * 2. Update progress at key milestones
 * 3. Link execution logs to deployment tasks
 * 4. Mark completion/failure appropriately
 * 
 * Usage:
 *   export NOTION_API_KEY=secret_xxx
 *   npx tsx examples/claude-coworker.ts
 */

import { createTracker } from '../src/index.js';

const apiKey = process.env.NOTION_API_KEY;
if (!apiKey) {
  console.error('❌ NOTION_API_KEY required');
  process.exit(1);
}

// Simulated deployment steps
interface DeploymentStep {
  name: string;
  duration: number; // ms
  progress: number;
}

const DEPLOYMENT_STEPS: DeploymentStep[] = [
  { name: 'Pulling latest code', duration: 500, progress: 10 },
  { name: 'Installing dependencies', duration: 800, progress: 25 },
  { name: 'Running type checks', duration: 600, progress: 40 },
  { name: 'Building Docker images', duration: 1000, progress: 60 },
  { name: 'Running health checks', duration: 500, progress: 80 },
  { name: 'Deploying to production', duration: 700, progress: 95 },
  { name: 'Verifying deployment', duration: 400, progress: 100 },
];

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runDeployment() {
  const tracker = createTracker({ apiKey });
  
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     Claude Coworker - ResearchFlow Deployment Execution      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  // Configuration
  const taskId = process.argv[2] || undefined;
  const toolInstanceId = `claude-coworker-${Date.now()}`;
  
  console.log(`📋 Configuration:`);
  console.log(`   Task ID: ${taskId || '(none - standalone execution)'}`);
  console.log(`   Tool Instance: ${toolInstanceId}`);
  console.log('');
  
  let session;
  
  try {
    // =========================================================================
    // PHASE 1: Start Execution
    // =========================================================================
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('PHASE 1: Starting Execution');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    if (taskId) {
      // Start execution linked to a task
      session = await tracker.startTask(taskId, {
        name: 'Claude Coworker Deployment',
        stream: 'Backend',
        toolInstanceId,
        notes: 'Automated deployment via Claude Coworker',
      });
    } else {
      // Start standalone execution
      session = await tracker.startExecution({
        name: 'Claude Coworker Deployment (Standalone)',
        stream: 'Backend',
        toolInstanceId,
        notes: 'Automated deployment via Claude Coworker (no task link)',
      });
    }
    
    console.log(`✅ Execution started:`);
    console.log(`   Execution ID: ${session.executionId}`);
    console.log(`   Started at: ${session.startedAt.toISOString()}`);
    console.log('');
    
    // =========================================================================
    // PHASE 2: Execute Deployment Steps
    // =========================================================================
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('PHASE 2: Executing Deployment Steps');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    for (const step of DEPLOYMENT_STEPS) {
      const startTime = Date.now();
      process.stdout.write(`⏳ ${step.name}...`);
      
      // Simulate work
      await sleep(step.duration);
      
      // Update progress in Notion
      await tracker.updateProgress(
        session.executionId,
        step.progress,
        `Completed: ${step.name}`
      );
      
      const elapsed = Date.now() - startTime;
      console.log(` ✓ (${elapsed}ms) [${step.progress}%]`);
    }
    
    console.log('');
    
    // =========================================================================
    // PHASE 3: Complete Execution
    // =========================================================================
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('PHASE 3: Completing Execution');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    await tracker.completeExecution(session.executionId, {
      status: 'Complete',
      notes: 'All deployment steps completed successfully. Production is live.',
    });
    
    console.log('✅ Deployment completed successfully!');
    console.log(`   Duration: ${((Date.now() - session.startedAt.getTime()) / 1000).toFixed(2)}s`);
    console.log('');
    
    // =========================================================================
    // Summary
    // =========================================================================
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    console.log('📊 Notion Updates Made:');
    console.log('   1. Created execution log entry with Status=Running');
    console.log('   2. Updated progress 7 times (after each step)');
    console.log('   3. Set final Status=Complete with timestamp');
    if (taskId) {
      console.log(`   4. Updated task ${taskId} status and linked execution log`);
    }
    console.log('');
    console.log('🔗 View in Notion:');
    console.log('   - Deployment Execution Log: Check "⚡ Currently Running" or "🎯 Live Status Board"');
    if (taskId) {
      console.log('   - Deployment Tasks: Check the linked task for status update');
    }
    
  } catch (error) {
    // =========================================================================
    // Error Handling
    // =========================================================================
    console.error('\n❌ Deployment failed:', error);
    
    if (session) {
      console.log('\n🔄 Marking execution as failed in Notion...');
      await tracker.failExecution(
        session.executionId,
        `Error: ${error instanceof Error ? error.message : String(error)}`,
        'Deployment failed - see blocking issues for details'
      );
      console.log('   ✓ Execution marked as Failed');
    }
    
    await tracker.cleanup();
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Received SIGINT, cleaning up...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n⚠️  Received SIGTERM, cleaning up...');
  process.exit(0);
});

runDeployment();
