# ResearchFlow Notion Integration

Track deployment tasks and execution logs in Notion for the ResearchFlow platform.

## Features

- 📊 **Deployment Task Tracking** - Create, update, and query deployment tasks
- 🚀 **Execution Log Management** - Track tool executions with real-time progress
- 🔗 **Task-Execution Linking** - Automatically link execution logs to tasks
- ⏱️ **Auto-Progress Updates** - Optional automatic progress syncing
- 🛠️ **CLI Support** - Shell-friendly commands for CI/CD integration

## Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build
```

## Configuration

### Environment Variables

```bash
export NOTION_API_KEY=secret_xxx
```

### Notion Database IDs (Pre-configured)

The module uses these ResearchFlow database IDs by default:

| Database | Data Source ID |
|----------|---------------|
| Deployment Tasks | `52e84cac-8ed0-4231-b9c8-5b854d042b9b` |
| Execution Log | `79d9d19c-9de3-4674-976f-fa9ad96ea826` |

## Usage

### TypeScript/JavaScript

```typescript
import { createTracker } from '@researchflow/notion-integration';

const tracker = createTracker({
  apiKey: process.env.NOTION_API_KEY!,
});

// Start working on a task
const session = await tracker.startTask('DOCK-006', {
  name: 'Docker production build',
  stream: 'Frontend',
  toolInstanceId: 'claude-coworker-1',
});

// Update progress during execution
await tracker.updateProgress(session.executionId, 50, 'Building images...');

// Complete the execution
await tracker.completeExecution(session.executionId, {
  status: 'Complete',
  notes: 'Successfully deployed to production',
});
```

### CLI (Shell Scripts)

```bash
# Start execution linked to a task
./cli.ts start --name "Docker Build" --stream Backend --task DOCK-006

# Update progress
./cli.ts progress --id exec-xxx --progress 50 --notes "Building..."

# Complete
./cli.ts complete --id exec-xxx --notes "Success!"

# Mark as failed
./cli.ts fail --id exec-xxx --issues "Build error" --notes "See logs"

# List running executions
./cli.ts running

# Get task details
./cli.ts task --id DOCK-006
```

## API Reference

### ExecutionTracker

#### `startExecution(options)`

Start a new execution session.

```typescript
const session = await tracker.startExecution({
  name: 'Deployment Run',
  stream: 'Backend',           // Frontend|Backend|Testing|AI Integration|Design
  taskId: 'DOCK-006',          // Optional: link to deployment task
  toolInstanceId: 'worker-1',  // Optional: identify tool instance
  notes: 'Starting deployment',
  autoUpdateProgress: true,    // Optional: auto-sync progress
  progressIntervalMs: 30000,   // Optional: sync interval (default 30s)
});
```

#### `updateProgress(executionId, percent, notes?)`

Update execution progress.

```typescript
await tracker.updateProgress(session.executionId, 50, 'Halfway done');
```

#### `completeExecution(executionId, options)`

Complete an execution (success or failure).

```typescript
await tracker.completeExecution(session.executionId, {
  status: 'Complete',  // or 'Failed'
  notes: 'All done!',
  blockingIssues: 'Error message',  // for failures
});
```

#### `startTask(taskId, options)`

Convenience method to start execution linked to a task.

```typescript
const session = await tracker.startTask('DOCK-006', {
  name: 'Build Phase',
  stream: 'Frontend',
});
```

#### `failExecution(executionId, blockingIssues, notes?)`

Mark an execution as failed.

```typescript
await tracker.failExecution(
  session.executionId,
  'Build failed: missing dependency',
  'See build logs for details'
);
```

### NotionClient

Lower-level API for direct database operations.

```typescript
import { createClient } from '@researchflow/notion-integration';

const client = createClient({ apiKey });

// Query tasks
const tasks = await client.getDeploymentTasks('🟡 In Progress');

// Get specific task
const task = await client.getDeploymentTaskByTaskId('DOCK-006');

// Update task
await client.updateDeploymentTaskByTaskId('DOCK-006', {
  status: '🟢 Complete',
  progressPercent: 100,
  completedAt: new Date(),
});

// Query execution logs
const running = await client.getExecutionLogs('Running');
```

## Database Schema

### Deployment Tasks

| Property | Type | Description |
|----------|------|-------------|
| Task ID | text | Unique identifier for API lookups |
| Task | title | Task name |
| Status | select | 🔴 Critical, 🟡 In Progress, 🟢 Complete, ⚪ Pending |
| Progress % | number | 0-100 |
| Started At | date | When execution begins |
| Completed At | date | When execution ends |
| Last Updated | date | API sync timestamp |
| AI Tool | select | Claude, GPT-4, Grok, Mercury, etc. |
| Phase | select | Phase 1-4 |
| Priority | select | P0-P3 |
| Execution Logs | relation | Links to execution log entries |

### Deployment Execution Log

| Property | Type | Description |
|----------|------|-------------|
| Execution ID | text | Unique identifier for API lookups |
| Name | title | Execution name |
| Tool Instance ID | text | Tracks concurrent executions |
| Status | select | Pending, Running, Complete, Failed |
| Progress % | number | 0-100 |
| Started At | date | Execution start time |
| Completed At | date | Execution end time |
| Duration (min) | formula | Auto-calculated |
| Stream | select | Frontend, Backend, Testing, etc. |
| Blocking Issues | text | Error descriptions |

## Claude Coworker Integration

When Claude Coworker starts a task:

```typescript
// 1. Start execution
const session = await tracker.startTask(taskId, {
  name: `${taskName} Execution`,
  stream: 'Backend',
  toolInstanceId: 'claude-coworker-main',
});

// 2. Update progress at milestones
await tracker.updateProgress(session.executionId, 25, 'Phase 1 complete');
await tracker.updateProgress(session.executionId, 50, 'Phase 2 complete');
await tracker.updateProgress(session.executionId, 75, 'Phase 3 complete');

// 3. Complete or fail
try {
  // ... do work ...
  await tracker.completeExecution(session.executionId, {
    status: 'Complete',
    notes: 'All phases completed successfully',
  });
} catch (error) {
  await tracker.failExecution(
    session.executionId,
    error.message,
    'See logs for details'
  );
}
```

## Notion Views

The databases include these pre-configured views:

### Deployment Tasks
- **Default view** - All tasks in table format
- **🎯 Active Status Board** - Kanban grouped by status
- **⚡ Currently Active** - Filtered to In Progress
- **⏸️ Idle & Pending** - Filtered to Pending

### Execution Log
- **Default view** - All logs in table format
- **🎯 Live Status Board** - Kanban grouped by status
- **⚡ Currently Running** - Filtered to Running status

## Examples

Run the examples:

```bash
# Basic usage
export NOTION_API_KEY=secret_xxx
npx tsx examples/basic-usage.ts

# Claude Coworker simulation
npx tsx examples/claude-coworker.ts

# With task linking
npx tsx examples/claude-coworker.ts DOCK-006
```

## Error Handling

Always wrap executions in try/catch and call cleanup on failure:

```typescript
try {
  const session = await tracker.startExecution({ ... });
  // ... do work ...
  await tracker.completeExecution(session.executionId, { status: 'Complete' });
} catch (error) {
  if (session) {
    await tracker.failExecution(session.executionId, error.message);
  }
  throw error;
}
```

For graceful shutdown:

```typescript
process.on('SIGINT', async () => {
  await tracker.cleanup();
  process.exit(0);
});
```

## License

MIT
