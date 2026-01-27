/**
 * Action Executor Service
 *
 * Executes approved chat agent actions against artifacts.
 * Supports:
 * - JSON Patch operations
 * - Section replacements
 * - Content appending
 * - Table insertion
 * - Citation additions
 */

import { chatRepository, ChatAction } from '../../repositories/chat.repository';

// Types
export interface ActionExecutionResult {
  success: boolean;
  action: ChatAction;
  changes?: {
    before?: string;
    after?: string;
    diff?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface ArtifactContext {
  content: string;
  metadata: Record<string, unknown>;
  sections?: Record<string, string>;
}

export type ActionHandler = (
  action: ChatAction,
  artifact: ArtifactContext
) => Promise<{
  success: boolean;
  updatedContent?: string;
  updatedSections?: Record<string, string>;
  error?: string;
}>;

/**
 * Registry of action handlers by type
 */
const ACTION_HANDLERS: Record<string, ActionHandler> = {
  patch: handlePatchAction,
  replace_section: handleReplaceSectionAction,
  update_methods: handleUpdateMethodsAction,
  append: handleAppendAction,
  insert_table: handleInsertTableAction,
  add_citation: handleAddCitationAction,
};

/**
 * Execute an approved action
 */
export async function executeAction(
  actionId: string,
  artifact: ArtifactContext,
  onArtifactUpdate?: (updatedContent: string, metadata?: Record<string, unknown>) => Promise<void>
): Promise<ActionExecutionResult> {
  // Get the action
  const action = await chatRepository.getActionById(actionId);

  // Verify action is approved
  if (action.status !== 'approved') {
    return {
      success: false,
      action,
      error: {
        code: 'INVALID_STATUS',
        message: `Cannot execute action with status: ${action.status}. Action must be approved first.`,
      },
    };
  }

  // Get the handler
  const handler = ACTION_HANDLERS[action.actionType];

  if (!handler) {
    const updatedAction = await chatRepository.updateActionStatus(actionId, 'failed', {
      error: `Unknown action type: ${action.actionType}`,
    });

    return {
      success: false,
      action: updatedAction,
      error: {
        code: 'UNKNOWN_ACTION_TYPE',
        message: `No handler for action type: ${action.actionType}`,
      },
    };
  }

  try {
    // Execute the handler
    const result = await handler(action, artifact);

    if (!result.success) {
      const updatedAction = await chatRepository.updateActionStatus(actionId, 'failed', {
        error: result.error,
      });

      return {
        success: false,
        action: updatedAction,
        error: {
          code: 'EXECUTION_FAILED',
          message: result.error || 'Action execution failed',
        },
      };
    }

    // Apply the artifact update if callback provided
    if (onArtifactUpdate && result.updatedContent) {
      await onArtifactUpdate(result.updatedContent, artifact.metadata);
    }

    // Update action status to executed
    const updatedAction = await chatRepository.updateActionStatus(actionId, 'executed', {
      updatedContent: result.updatedContent,
      updatedSections: result.updatedSections,
      executedAt: new Date().toISOString(),
    });

    return {
      success: true,
      action: updatedAction,
      changes: {
        before: artifact.content.substring(0, 500) + '...',
        after: result.updatedContent?.substring(0, 500) + '...',
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    const updatedAction = await chatRepository.updateActionStatus(actionId, 'failed', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      success: false,
      action: updatedAction,
      error: {
        code: 'EXECUTION_ERROR',
        message: errorMessage,
      },
    };
  }
}

/**
 * Handle JSON Patch action
 */
async function handlePatchAction(
  action: ChatAction,
  artifact: ArtifactContext
): Promise<{ success: boolean; updatedContent?: string; error?: string }> {
  const { content, section } = action.payload as { content: string; section?: string };

  if (!content) {
    return { success: false, error: 'Patch content is required' };
  }

  // If section specified, apply to that section
  if (section && artifact.sections && artifact.sections[section]) {
    const updatedSections = { ...artifact.sections };
    updatedSections[section] = content;

    // Reconstruct full content
    const updatedContent = reconstructContent(updatedSections);
    return { success: true, updatedContent };
  }

  // Otherwise, append as a suggested edit
  const updatedContent = artifact.content + '\n\n<!-- Suggested Edit -->\n' + content;
  return { success: true, updatedContent };
}

/**
 * Handle section replacement action
 */
async function handleReplaceSectionAction(
  action: ChatAction,
  artifact: ArtifactContext
): Promise<{ success: boolean; updatedContent?: string; updatedSections?: Record<string, string>; error?: string }> {
  const { content, section } = action.payload as { content: string; section: string };

  if (!section) {
    return { success: false, error: 'Section name is required for replace_section' };
  }

  if (!content) {
    return { success: false, error: 'Replacement content is required' };
  }

  // If we have structured sections
  if (artifact.sections) {
    if (!(section in artifact.sections)) {
      return { success: false, error: `Section '${section}' not found in artifact` };
    }

    const updatedSections = { ...artifact.sections, [section]: content };
    const updatedContent = reconstructContent(updatedSections);

    return { success: true, updatedContent, updatedSections };
  }

  // Try to find and replace section in plain text
  const sectionPattern = new RegExp(
    `(##?\\s*${escapeRegex(section)}[\\s\\S]*?)(?=##|$)`,
    'i'
  );

  const match = artifact.content.match(sectionPattern);

  if (!match) {
    return { success: false, error: `Section '${section}' not found in artifact content` };
  }

  const updatedContent = artifact.content.replace(sectionPattern, `## ${section}\n\n${content}\n\n`);
  return { success: true, updatedContent };
}

/**
 * Handle methods section update action
 */
async function handleUpdateMethodsAction(
  action: ChatAction,
  artifact: ArtifactContext
): Promise<{ success: boolean; updatedContent?: string; error?: string }> {
  const { content } = action.payload as { content: string };

  if (!content) {
    return { success: false, error: 'Methods content is required' };
  }

  // Delegate to replace_section with 'Methods' or 'Statistical Analysis' section
  const methodsSections = ['Methods', 'Statistical Analysis', 'Statistical Methods', 'Analysis'];

  for (const section of methodsSections) {
    const result = await handleReplaceSectionAction(
      { ...action, payload: { ...action.payload, section } } as ChatAction,
      artifact
    );

    if (result.success) {
      return result;
    }
  }

  // If no methods section found, append
  const updatedContent = artifact.content + '\n\n## Statistical Methods\n\n' + content;
  return { success: true, updatedContent };
}

/**
 * Handle append action
 */
async function handleAppendAction(
  action: ChatAction,
  artifact: ArtifactContext
): Promise<{ success: boolean; updatedContent?: string; error?: string }> {
  const { content } = action.payload as { content: string };

  if (!content) {
    return { success: false, error: 'Append content is required' };
  }

  const updatedContent = artifact.content.trimEnd() + '\n\n' + content;
  return { success: true, updatedContent };
}

/**
 * Handle table insertion action
 */
async function handleInsertTableAction(
  action: ChatAction,
  artifact: ArtifactContext
): Promise<{ success: boolean; updatedContent?: string; error?: string }> {
  const { content, name, section } = action.payload as { content: string; name?: string; section?: string };

  if (!content) {
    return { success: false, error: 'Table content is required' };
  }

  const tableBlock = name ? `### ${name}\n\n${content}` : content;

  // If section specified, insert after section header
  if (section) {
    const sectionPattern = new RegExp(`(##?\\s*${escapeRegex(section)}[^\n]*)`, 'i');
    const match = artifact.content.match(sectionPattern);

    if (match) {
      const updatedContent = artifact.content.replace(
        sectionPattern,
        `$1\n\n${tableBlock}\n`
      );
      return { success: true, updatedContent };
    }
  }

  // Default: append to end
  const updatedContent = artifact.content.trimEnd() + '\n\n' + tableBlock;
  return { success: true, updatedContent };
}

/**
 * Handle citation addition action
 */
async function handleAddCitationAction(
  action: ChatAction,
  artifact: ArtifactContext
): Promise<{ success: boolean; updatedContent?: string; error?: string }> {
  const { content, name } = action.payload as { content: string; name?: string };

  if (!name && !content) {
    return { success: false, error: 'Citation identifier (PMID) or content is required' };
  }

  // Find or create References section
  const referencesPattern = /##?\s*References\s*\n/i;
  const hasReferences = referencesPattern.test(artifact.content);

  const citationText = name ? `[${name}] ${content}` : content;

  if (hasReferences) {
    // Append to existing References section
    const updatedContent = artifact.content.replace(
      referencesPattern,
      `## References\n\n${citationText}\n`
    );
    return { success: true, updatedContent };
  }

  // Create new References section
  const updatedContent = artifact.content.trimEnd() + '\n\n## References\n\n' + citationText;
  return { success: true, updatedContent };
}

/**
 * Reconstruct content from sections
 */
function reconstructContent(sections: Record<string, string>): string {
  const sectionOrder = [
    'Title',
    'Abstract',
    'Introduction',
    'Background',
    'Methods',
    'Statistical Methods',
    'Results',
    'Discussion',
    'Conclusion',
    'References',
    'Appendix',
  ];

  const orderedSections: string[] = [];
  const usedKeys = new Set<string>();

  // Add sections in order
  for (const key of sectionOrder) {
    if (sections[key]) {
      orderedSections.push(`## ${key}\n\n${sections[key]}`);
      usedKeys.add(key);
    }
  }

  // Add remaining sections
  for (const [key, value] of Object.entries(sections)) {
    if (!usedKeys.has(key)) {
      orderedSections.push(`## ${key}\n\n${value}`);
    }
  }

  return orderedSections.join('\n\n');
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Register a custom action handler
 */
export function registerActionHandler(actionType: string, handler: ActionHandler): void {
  ACTION_HANDLERS[actionType] = handler;
}

export default {
  executeAction,
  registerActionHandler,
};
