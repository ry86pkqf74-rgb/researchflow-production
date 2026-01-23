/**
 * AI Writing Tools
 * Phase 4.1: Writing assistance tools for manuscript authoring
 * 
 * Tools:
 * - paraphrase: Rewrite text while preserving meaning
 * - expand: Elaborate on brief text
 * - condense: Shorten text while preserving key points
 * - formalize: Convert casual text to academic style
 * - clarify: Improve clarity and readability
 * - transition: Generate transitional sentences
 * - citation_context: Generate context for citations
 */

import { PhiGateService } from '../phi-gate.service';
import { logAction } from '../../../orchestrator/src/services/audit-service';

export interface WritingToolInput {
  text: string;
  context?: string;
  options?: Record<string, any>;
}

export interface WritingToolOutput {
  original: string;
  result: string;
  toolName: string;
  tokensUsed?: number;
  phiScanned: boolean;
  timestamp: string;
}

export type WritingToolFunction = (input: WritingToolInput) => Promise<WritingToolOutput>;

/**
 * Base tool wrapper with PHI scanning and audit logging
 */
async function withPhiGuard(
  toolName: string,
  input: WritingToolInput,
  processor: (text: string, context?: string) => Promise<string>
): Promise<WritingToolOutput> {
  const phiGate = PhiGateService.getInstance();
  
  // Scan input for PHI
  const scanResult = await phiGate.scan(input.text);
  
  if (scanResult.hasPhi) {
    // Log PHI detection
    await logAction({
      eventType: 'PHI_DETECTED_IN_TOOL',
      action: 'BLOCK',
      resourceType: 'WRITING_TOOL',
      resourceId: toolName,
      details: { stats: scanResult.stats }
    });
    
    throw new Error(`PHI detected in input. Tool ${toolName} cannot process text containing PHI.`);
  }
  
  // Process the text
  const result = await processor(input.text, input.context);
  
  // Scan output for PHI (defense in depth)
  const outputScan = await phiGate.scan(result);
  if (outputScan.hasPhi) {
    throw new Error('PHI detected in tool output. Operation blocked.');
  }
  
  // Log successful tool use
  await logAction({
    eventType: 'WRITING_TOOL_USED',
    action: 'EXECUTE',
    resourceType: 'WRITING_TOOL',
    resourceId: toolName,
    details: { inputLength: input.text.length, outputLength: result.length }
  });
  
  return {
    original: input.text,
    result,
    toolName,
    phiScanned: true,
    timestamp: new Date().toISOString()
  };
}

/**
 * Paraphrase Tool
 * Rewrites text while preserving the original meaning
 */
export const paraphraseTool: WritingToolFunction = async (input) => {
  return withPhiGuard('paraphrase', input, async (text, context) => {
    const prompt = `Paraphrase the following text while maintaining its academic tone and meaning.
${context ? `Context: ${context}\n` : ''}
Original text: "${text}"

Provide only the paraphrased version without any explanations.`;
    
    // This would call the LLM - placeholder for actual implementation
    return `[Paraphrased: ${text}]`;
  });
};

/**
 * Expand Tool
 * Elaborates on brief text with additional detail
 */
export const expandTool: WritingToolFunction = async (input) => {
  return withPhiGuard('expand', input, async (text, context) => {
    const targetLength = input.options?.targetWords || 150;
    const prompt = `Expand the following text to approximately ${targetLength} words while maintaining academic style.
${context ? `Context: ${context}\n` : ''}
Original text: "${text}"

Provide only the expanded version.`;
    
    return `[Expanded: ${text}]`;
  });
};

/**
 * Condense Tool
 * Shortens text while preserving key points
 */
export const condenseTool: WritingToolFunction = async (input) => {
  return withPhiGuard('condense', input, async (text, context) => {
    const targetReduction = input.options?.reductionPercent || 50;
    const prompt = `Condense the following text by approximately ${targetReduction}% while preserving the key points.
${context ? `Context: ${context}\n` : ''}
Original text: "${text}"

Provide only the condensed version.`;
    
    return `[Condensed: ${text}]`;
  });
};

/**
 * Formalize Tool
 * Converts casual text to academic style
 */
export const formalizeTool: WritingToolFunction = async (input) => {
  return withPhiGuard('formalize', input, async (text, context) => {
    const style = input.options?.style || 'academic';
    const prompt = `Convert the following text to ${style} academic writing style.
${context ? `Context: ${context}\n` : ''}
Original text: "${text}"

Provide only the formalized version.`;
    
    return `[Formalized: ${text}]`;
  });
};

/**
 * Clarify Tool
 * Improves clarity and readability
 */
export const clarifyTool: WritingToolFunction = async (input) => {
  return withPhiGuard('clarify', input, async (text, context) => {
    const prompt = `Improve the clarity and readability of the following text while maintaining academic tone.
${context ? `Context: ${context}\n` : ''}
Original text: "${text}"

Provide only the clarified version.`;
    
    return `[Clarified: ${text}]`;
  });
};

/**
 * Transition Tool
 * Generates transitional sentences between ideas
 */
export const transitionTool: WritingToolFunction = async (input) => {
  return withPhiGuard('transition', input, async (text, context) => {
    const fromSection = input.options?.fromSection || 'previous';
    const toSection = input.options?.toSection || 'next';
    const prompt = `Generate a transitional sentence to connect from "${fromSection}" to "${toSection}".
${context ? `Context: ${context}\n` : ''}
Current text: "${text}"

Provide only the transition sentence.`;
    
    return `[Transition: ${text}]`;
  });
};

/**
 * Citation Context Tool
 * Generates appropriate context for citations
 */
export const citationContextTool: WritingToolFunction = async (input) => {
  return withPhiGuard('citation_context', input, async (text, context) => {
    const citationType = input.options?.type || 'supporting';
    const prompt = `Generate a sentence that provides ${citationType} context for the following citation.
${context ? `Paper context: ${context}\n` : ''}
Citation: "${text}"

Provide only the contextual sentence.`;
    
    return `[Citation context: ${text}]`;
  });
};

/**
 * Section Opener Tool
 * Generates opening sentences for manuscript sections
 */
export const sectionOpenerTool: WritingToolFunction = async (input) => {
  return withPhiGuard('section_opener', input, async (text, context) => {
    const section = input.options?.section || 'methods';
    const prompt = `Generate an opening sentence for the ${section} section of a research manuscript.
${context ? `Study context: ${context}\n` : ''}
Key topic: "${text}"

Provide only the opening sentence.`;
    
    return `[Section opener for ${section}: ${text}]`;
  });
};

/**
 * Limitation Framer Tool
 * Frames study limitations constructively
 */
export const limitationFramerTool: WritingToolFunction = async (input) => {
  return withPhiGuard('limitation_framer', input, async (text, context) => {
    const prompt = `Frame the following study limitation constructively for a manuscript discussion section.
${context ? `Study context: ${context}\n` : ''}
Limitation: "${text}"

Provide the framed limitation statement.`;
    
    return `[Limitation framed: ${text}]`;
  });
};

/**
 * All writing tools registry
 */
export const WRITING_TOOLS: Record<string, WritingToolFunction> = {
  paraphrase: paraphraseTool,
  expand: expandTool,
  condense: condenseTool,
  formalize: formalizeTool,
  clarify: clarifyTool,
  transition: transitionTool,
  citation_context: citationContextTool,
  section_opener: sectionOpenerTool,
  limitation_framer: limitationFramerTool
};

/**
 * Get tool by name
 */
export function getWritingTool(name: string): WritingToolFunction | undefined {
  return WRITING_TOOLS[name.toLowerCase()];
}

/**
 * List available tools
 */
export function listWritingTools(): string[] {
  return Object.keys(WRITING_TOOLS);
}

export default WRITING_TOOLS;
