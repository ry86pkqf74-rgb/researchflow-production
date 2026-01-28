#!/usr/bin/env tsx
/**
 * ResearchFlow Notion CLI
 * 
 * Command-line interface for Notion deployment tracking.
 * Designed for use in shell scripts and CI/CD pipelines.
 * 
 * Commands:
 *   start-execution  - Start a new execution log entry
 *   update-progress  - Update execution progress
 *   complete         - Mark execution as complete
 *   fail             - Mark execution as failed
 *   list-running     - List currently running executions
 *   get-task         - Get task details by Task ID
 *   update-task      - Update task status
 * 
 * Usage:
 *   export NOTION_API_KEY=secret_xxx
 *   
 *   # Start execution
 *   ./cli.ts start-execution --name "Docker Build" --stream Backend
 *   
 *   # Update progress
 *   ./cli.ts update-progress --id exec-xxx --progress 50 --notes "Building..."
 *   
 *   # Complete
 *   ./cli.ts complete --id exec-xxx --notes "Success!"
 */

import { createTracker, createClient, ExecutionStream } from '../src/index.js';

const apiKey = process.env.NOTION_API_KEY;
if (!apiKey) {
  console.error('Error: NOTION_API_KEY environment variable required');
  process.exit(1);
}

const tracker = createTracker({ apiKey });
const client = createClient({ apiKey });

// Parse command line arguments
function parseArgs(): { command: string; args: Record<string, string> } {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const parsed: Record<string, string> = {};
  
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : 'true';
      parsed[key] = value;
    }
  }
  
  return { command, args: parsed };
}

// Output as JSON for easy parsing in scripts
function output(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  const { command, args } = parseArgs();
  
  try {
    switch (command) {
      // =========================================================================
      // start-execution
      // =========================================================================
      case 'start-execution':
      case 'start': {
        if (!args.name) {
          console.error('Error: --name required');
          process.exit(1);
        }
        
        const stream = (args.stream || 'Backend') as ExecutionStream;
        const session = await tracker.startExecution({
          name: args.name,
          stream,
          taskId: args.task,
          toolInstanceId: args.tool,
          notes: args.notes,
        });
        
        output({
          success: true,
          executionId: session.executionId,
          toolInstanceId: session.toolInstanceId,
          startedAt: session.startedAt.toISOString(),
        });
        break;
      }
      
      // =========================================================================
      // update-progress
      // =========================================================================
      case 'update-progress':
      case 'progress': {
        if (!args.id || !args.progress) {
          console.error('Error: --id and --progress required');
          process.exit(1);
        }
        
        const progress = parseInt(args.progress, 10);
        await tracker.updateProgress(args.id, progress, args.notes);
        
        output({
          success: true,
          executionId: args.id,
          progress,
        });
        break;
      }
      
      // =========================================================================
      // complete
      // =========================================================================
      case 'complete': {
        if (!args.id) {
          console.error('Error: --id required');
          process.exit(1);
        }
        
        await tracker.completeExecution(args.id, {
          status: 'Complete',
          notes: args.notes,
        });
        
        output({
          success: true,
          executionId: args.id,
          status: 'Complete',
        });
        break;
      }
      
      // =========================================================================
      // fail
      // =========================================================================
      case 'fail': {
        if (!args.id) {
          console.error('Error: --id required');
          process.exit(1);
        }
        
        await tracker.failExecution(
          args.id,
          args.issues || 'Execution failed',
          args.notes
        );
        
        output({
          success: true,
          executionId: args.id,
          status: 'Failed',
        });
        break;
      }
      
      // =========================================================================
      // list-running
      // =========================================================================
      case 'list-running':
      case 'running': {
        const executions = await tracker.getRunningExecutions();
        
        output({
          count: executions.length,
          executions: executions.map(e => ({
            executionId: e.executionId,
            name: e.name,
            stream: e.stream,
            progress: e.progressPercent,
            startedAt: e.startedAt?.toISOString(),
            toolInstanceId: e.toolInstanceId,
          })),
        });
        break;
      }
      
      // =========================================================================
      // get-task
      // =========================================================================
      case 'get-task':
      case 'task': {
        if (!args.id) {
          console.error('Error: --id (Task ID) required');
          process.exit(1);
        }
        
        const task = await client.getDeploymentTaskByTaskId(args.id);
        
        if (task) {
          output({
            found: true,
            task: {
              taskId: task.taskId,
              name: task.name,
              status: task.status,
              progress: task.progressPercent,
              phase: task.phase,
              priority: task.priority,
              aiTool: task.aiTool,
              startedAt: task.startedAt?.toISOString(),
              completedAt: task.completedAt?.toISOString(),
              executionLogs: task.executionLogs,
            },
          });
        } else {
          output({
            found: false,
            taskId: args.id,
          });
        }
        break;
      }
      
      // =========================================================================
      // update-task
      // =========================================================================
      case 'update-task': {
        if (!args.id) {
          console.error('Error: --id (Task ID) required');
          process.exit(1);
        }
        
        const updateData: Record<string, unknown> = {};
        
        if (args.status) updateData.status = args.status;
        if (args.progress) updateData.progressPercent = parseInt(args.progress, 10);
        if (args.notes) updateData.notes = args.notes;
        
        const task = await client.updateDeploymentTaskByTaskId(args.id, updateData);
        
        if (task) {
          output({
            success: true,
            taskId: task.taskId,
            status: task.status,
            progress: task.progressPercent,
          });
        } else {
          output({
            success: false,
            error: 'Task not found',
          });
        }
        break;
      }
      
      // =========================================================================
      // list-tasks
      // =========================================================================
      case 'list-tasks':
      case 'tasks': {
        const status = args.status as any;
        const tasks = await client.getDeploymentTasks(status);
        
        output({
          count: tasks.length,
          filter: args.status || 'all',
          tasks: tasks.map(t => ({
            taskId: t.taskId,
            name: t.name,
            status: t.status,
            progress: t.progressPercent,
            phase: t.phase,
            priority: t.priority,
          })),
        });
        break;
      }
      
      // =========================================================================
      // help
      // =========================================================================
      case 'help':
      default: {
        console.log(`
ResearchFlow Notion CLI

Commands:
  start-execution  Start a new execution log entry
    --name         Execution name (required)
    --stream       Stream: Frontend|Backend|Testing|AI Integration|Design
    --task         Task ID to link to
    --tool         Tool instance ID
    --notes        Notes

  update-progress  Update execution progress
    --id           Execution ID (required)
    --progress     Progress 0-100 (required)
    --notes        Notes

  complete         Mark execution as complete
    --id           Execution ID (required)
    --notes        Notes

  fail             Mark execution as failed
    --id           Execution ID (required)
    --issues       Blocking issues description
    --notes        Notes

  list-running     List currently running executions

  get-task         Get task details
    --id           Task ID (required)

  update-task      Update task status
    --id           Task ID (required)
    --status       Status: 🔴 Critical|🟡 In Progress|🟢 Complete|⚪ Pending
    --progress     Progress 0-100
    --notes        Notes

  list-tasks       List deployment tasks
    --status       Filter by status (optional)

Environment:
  NOTION_API_KEY   Notion API key (required)

Examples:
  # Start execution for a task
  ./cli.ts start --name "Build Docker" --stream Backend --task DOCK-006

  # Update progress
  ./cli.ts progress --id exec-123 --progress 50 --notes "Building..."

  # Complete execution
  ./cli.ts complete --id exec-123 --notes "Success!"

  # List running
  ./cli.ts running
`);
        break;
      }
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
