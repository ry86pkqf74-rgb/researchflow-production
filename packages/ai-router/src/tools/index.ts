/**
 * AI Router Tools Registry
 * Phase 4.1: Central registration for all AI writing tools
 * 
 * Exports all tools with PHI guard integration and audit logging.
 */

export {
  WRITING_TOOLS,
  getWritingTool,
  listWritingTools,
  paraphraseTool,
  expandTool,
  condenseTool,
  formalizeTool,
  clarifyTool,
  transitionTool,
  citationContextTool,
  sectionOpenerTool,
  limitationFramerTool,
  type WritingToolInput,
  type WritingToolOutput,
  type WritingToolFunction
} from './writing-tools';

/**
 * Tool categories for UI organization
 */
export const TOOL_CATEGORIES = {
  text_transformation: ['paraphrase', 'expand', 'condense', 'formalize', 'clarify'],
  structure: ['transition', 'section_opener'],
  citation: ['citation_context'],
  discussion: ['limitation_framer']
};

/**
 * Tool metadata for UI display
 */
export const TOOL_METADATA: Record<string, { 
  name: string; 
  description: string; 
  category: string;
  shortcut?: string;
}> = {
  paraphrase: {
    name: 'Paraphrase',
    description: 'Rewrite text while preserving meaning',
    category: 'text_transformation',
    shortcut: 'Ctrl+Shift+P'
  },
  expand: {
    name: 'Expand',
    description: 'Elaborate on brief text with additional detail',
    category: 'text_transformation',
    shortcut: 'Ctrl+Shift+E'
  },
  condense: {
    name: 'Condense',
    description: 'Shorten text while preserving key points',
    category: 'text_transformation',
    shortcut: 'Ctrl+Shift+C'
  },
  formalize: {
    name: 'Formalize',
    description: 'Convert casual text to academic style',
    category: 'text_transformation',
    shortcut: 'Ctrl+Shift+F'
  },
  clarify: {
    name: 'Clarify',
    description: 'Improve clarity and readability',
    category: 'text_transformation',
    shortcut: 'Ctrl+Shift+L'
  },
  transition: {
    name: 'Transition',
    description: 'Generate transitional sentences',
    category: 'structure',
    shortcut: 'Ctrl+Shift+T'
  },
  section_opener: {
    name: 'Section Opener',
    description: 'Generate opening sentences for sections',
    category: 'structure'
  },
  citation_context: {
    name: 'Citation Context',
    description: 'Generate context for citations',
    category: 'citation'
  },
  limitation_framer: {
    name: 'Limitation Framer',
    description: 'Frame study limitations constructively',
    category: 'discussion'
  }
};
