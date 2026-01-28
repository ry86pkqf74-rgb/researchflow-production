#!/usr/bin/env tsx
/**
 * Basic Usage Example
 * 
 * Demonstrates core functionality of the ResearchFlow Notion Integration:
 * - Creating execution log entries
 * - Updating progress
 * - Completing executions
 * - Linking executions to tasks
 * 
 * Usage:
 *   export NOTION_API_KEY=secret_xxx
 *   npx tsx examples/basic-usage.ts
 */

import { createTracker, createClient } from '../src/index.js';

// Ensure API key is set
const apiKey = process.env.NOTION_API_KEY;
if (!apiKey) {
  console.error('❌ Error: NOTION_API_KEY environment variable is required');
  console.error('  export NOTION_API_KEY=secret_xxx');
  process.exit(1);
}

async function main() {
  console.log('🚀 ResearchFlow Notion Integration - Basic Usage Example\n');
  
  // Create tracker instance
  const tracker = createTracker({ apiKey });
  const client = createClient({ apiKey });
  
  try {
    // =========================================================================
    // Example 1: Start a standalone execution
    // =========================================================================
    console.log('📝 Example 1: Starting standalone execution...');
    
    const session = await tracker.startExecution({
      name: 'Example: Basic Test Execution',
      stream: 'Testing',
      notes: 'Testing Notion integration',
    });
    
    console.log(`  ✓ Created execution: ${session.executionId}`);
    console.log(`  ✓ Tool instance: ${session.toolInstanceId}`);
    
    // Simulate progress updates
    console.log('\n📊 Updating progress...');
    await tracker.updateProgress(session.executionId, 25, 'Phase 1 complete');
    console.log('  ✓ Progress: 25%');
    
    await tracker.updateProgress(session.executionId, 50, 'Phase 2 complete');
    console.log('  ✓ Progress: 50%');
    
    await tracker.updateProgress(session.executionId, 75, 'Phase 3 complete');
    console.log('  ✓ Progress: 75%');
    
    // Complete the execution
    console.log('\n✅ Completing execution...');
    await tracker.completeExecution(session.executionId, {
      status: 'Complete',
      notes: 'All phases completed successfully',
    });
    console.log('  ✓ Execution marked as Complete');
    
    // =========================================================================
    // Example 2: Query running executions
    // =========================================================================
    console.log('\n📋 Example 2: Querying running executions...');
    
    const runningExecutions = await tracker.getRunningExecutions();
    console.log(`  Found ${runningExecutions.length} running execution(s)`);
    
    for (const exec of runningExecutions) {
      console.log(`    - ${exec.name} (${exec.executionId}): ${exec.progressPercent}%`);
    }
    
    // =========================================================================
    // Example 3: Query tasks by status
    // =========================================================================
    console.log('\n📋 Example 3: Querying tasks by status...');
    
    const inProgressTasks = await client.getDeploymentTasks('🟡 In Progress');
    console.log(`  Found ${inProgressTasks.length} in-progress task(s)`);
    
    for (const task of inProgressTasks.slice(0, 5)) {
      console.log(`    - [${task.taskId}] ${task.name}: ${task.progressPercent}%`);
    }
    
    const pendingTasks = await client.getDeploymentTasks('⚪ Pending');
    console.log(`  Found ${pendingTasks.length} pending task(s)`);
    
    // =========================================================================
    // Example 4: Get a specific task
    // =========================================================================
    console.log('\n🔍 Example 4: Looking up specific task...');
    
    // Try to find a task (adjust task ID as needed)
    const sampleTaskId = 'DOCK-006';
    const task = await client.getDeploymentTaskByTaskId(sampleTaskId);
    
    if (task) {
      console.log(`  Found task: ${task.name}`);
      console.log(`    Status: ${task.status}`);
      console.log(`    Progress: ${task.progressPercent}%`);
      console.log(`    Phase: ${task.phase || 'N/A'}`);
      console.log(`    Priority: ${task.priority || 'N/A'}`);
    } else {
      console.log(`  Task ${sampleTaskId} not found (this is OK for the example)`);
    }
    
    console.log('\n✨ Example complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await tracker.cleanup();
    process.exit(1);
  }
}

main();
