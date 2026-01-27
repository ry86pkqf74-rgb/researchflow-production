/**
 * Base Agent Class
 *
 * Abstract base class for all AI agents.
 */

import type { AgentConfig, AgentInput, AgentOutput, IAgent } from '../types/agent.types.js';

export abstract class BaseAgent implements IAgent {
  constructor(public readonly config: AgentConfig) {}

  abstract execute(input: AgentInput): Promise<AgentOutput>;

  validateInput(input: AgentInput): boolean {
    return typeof input.query === 'string' && input.query.length > 0;
  }

  protected buildPrompt(input: AgentInput): string {
    // Override in subclasses for specialized prompts
    return input.query;
  }

  protected async postProcess(rawOutput: string): Promise<string> {
    // Override for PHI scanning, citation extraction, etc.
    return rawOutput;
  }

  protected extractCitations(output: string): string[] {
    // Extract citations from output
    const citationPattern = /\[(\d+)\]|\(([A-Za-z]+\s+et\s+al\.,?\s*\d{4})\)/g;
    const matches = output.match(citationPattern) || [];
    return [...new Set(matches)];
  }
}
