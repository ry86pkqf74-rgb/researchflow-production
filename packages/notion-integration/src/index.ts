/**
 * ResearchFlow Notion Integration
 * 
 * Track deployment tasks and execution logs in Notion.
 * 
 * @example
 * ```typescript
 * import { createTracker } from './notion-integration';
 * 
 * const tracker = createTracker({
 *   apiKey: process.env.NOTION_API_KEY!,
 * });
 * 
 * // Start working on a task
 * const session = await tracker.startTask('DOCK-006', {
 *   name: 'Docker production build',
 *   stream: 'Frontend',
 * });
 * 
 * // Update progress
 * await tracker.updateProgress(session.executionId, 50, 'Building images...');
 * 
 * // Complete execution
 * await tracker.completeExecution(session.executionId, {
 *   status: 'Complete',
 *   notes: 'Successfully deployed'
 * });
 * ```
 */

export * from './types.js';
export { NotionClient } from './notion-client.js';
export { ExecutionTracker } from './execution-tracker.js';

import { NotionClient } from './notion-client.js';
import { ExecutionTracker } from './execution-tracker.js';

// Default data source IDs from ResearchFlow Notion setup
const DEFAULT_DEPLOYMENT_TASKS_ID = '52e84cac-8ed0-4231-b9c8-5b854d042b9b';
const DEFAULT_EXECUTION_LOG_ID = '79d9d19c-9de3-4674-976f-fa9ad96ea826';

export interface CreateTrackerOptions {
  apiKey: string;
  deploymentTasksDataSourceId?: string;
  executionLogDataSourceId?: string;
}

/**
 * Create an ExecutionTracker with default ResearchFlow database IDs
 * 
 * @example
 * const tracker = createTracker({
 *   apiKey: process.env.NOTION_API_KEY!,
 * });
 */
export function createTracker(options: CreateTrackerOptions): ExecutionTracker {
  const client = new NotionClient({
    apiKey: options.apiKey,
    deploymentTasksDataSourceId: options.deploymentTasksDataSourceId || DEFAULT_DEPLOYMENT_TASKS_ID,
    executionLogDataSourceId: options.executionLogDataSourceId || DEFAULT_EXECUTION_LOG_ID,
  });
  
  return new ExecutionTracker(client);
}

/**
 * Create a NotionClient for direct API access
 * 
 * @example
 * const client = createClient({
 *   apiKey: process.env.NOTION_API_KEY!,
 * });
 * 
 * const tasks = await client.getDeploymentTasks('🟡 In Progress');
 */
export function createClient(options: CreateTrackerOptions): NotionClient {
  return new NotionClient({
    apiKey: options.apiKey,
    deploymentTasksDataSourceId: options.deploymentTasksDataSourceId || DEFAULT_DEPLOYMENT_TASKS_ID,
    executionLogDataSourceId: options.executionLogDataSourceId || DEFAULT_EXECUTION_LOG_ID,
  });
}
