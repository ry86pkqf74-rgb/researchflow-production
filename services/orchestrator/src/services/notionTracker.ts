/**
 * Notion Execution Tracker Integration
 *
 * Tracks deployment tasks and execution logs in Notion
 */
import { createTracker, ExecutionTracker } from '@researchflow/notion-integration';

let tracker: ExecutionTracker | null = null;

export function getNotionTracker(): ExecutionTracker | null {
  if (!process.env.NOTION_API_KEY) {
    console.warn('NOTION_API_KEY not set - Notion tracking disabled');
    return null;
  }

  if (!tracker) {
    tracker = createTracker({
      apiKey: process.env.NOTION_API_KEY,
    });
  }

  return tracker;
}

export async function trackTaskExecution(
  taskId: string,
  name: string,
  stream: 'Frontend' | 'Backend' | 'Testing' | 'AI Integration' | 'Design',
  work: () => Promise<void>
): Promise<void> {
  const t = getNotionTracker();
  if (!t) {
    await work();
    return;
  }

  const session = await t.startTask(taskId, {
    name,
    stream,
    toolInstanceId: 'orchestrator-main',
  });

  try {
    await work();
    await t.completeExecution(session.executionId, {
      status: 'Complete',
      notes: `${name} completed successfully`,
    });
  } catch (error) {
    await t.failExecution(
      session.executionId,
      error instanceof Error ? error.message : 'Unknown error',
      'See orchestrator logs for details'
    );
    throw error;
  }
}

export { ExecutionTracker } from '@researchflow/notion-integration';
