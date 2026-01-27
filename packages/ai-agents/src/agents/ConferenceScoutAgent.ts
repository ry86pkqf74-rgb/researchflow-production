/**
 * Conference Scout Agent
 *
 * Specialized agent for extracting conference submission guidelines.
 */

import { BaseAgent } from './BaseAgent.js';
import type { AgentInput, AgentOutput } from '../types/agent.types.js';
import { AGENT_REGISTRY } from '../registry.js';

export class ConferenceScoutAgent extends BaseAgent {
  constructor() {
    super(AGENT_REGISTRY['conference-scout']);
  }

  protected buildPrompt(input: AgentInput): string {
    return `You are a Conference Scout Agent specialized in extracting submission guidelines.

TASK: Analyze the provided conference information and extract:
1. Submission deadlines (abstract, full paper)
2. Word/character limits for abstracts
3. Required sections/format
4. Presentation format (oral, poster, both)
5. Registration requirements

CONTEXT:
${input.context ? JSON.stringify(input.context, null, 2) : 'No additional context'}

QUERY:
${input.query}

Respond in structured JSON format:
{
  "conferenceInfo": {
    "name": "Conference Name",
    "dates": "Conference dates",
    "location": "Location"
  },
  "deadlines": [
    { "type": "abstract", "date": "YYYY-MM-DD", "timezone": "UTC" }
  ],
  "formatRequirements": {
    "abstractWordLimit": 250,
    "fullPaperWordLimit": 5000,
    "requiredSections": ["Introduction", "Methods", "Results", "Conclusions"]
  },
  "presentationTypes": ["oral", "poster"],
  "recommendations": [
    "Specific recommendation based on query"
  ]
}`;
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();

    if (!this.validateInput(input)) {
      throw new Error('Invalid input: query is required');
    }

    const prompt = this.buildPrompt(input);

    // TODO: Integrate with actual AI provider via ai-router
    // For now, return structured placeholder
    const content = JSON.stringify(
      {
        conferenceInfo: {
          name: 'Placeholder Conference',
          dates: 'TBD',
          location: 'TBD',
        },
        deadlines: [],
        formatRequirements: {
          abstractWordLimit: 250,
          fullPaperWordLimit: null,
          requiredSections: [],
        },
        presentationTypes: ['oral', 'poster'],
        recommendations: [
          `Based on your query "${input.query.substring(0, 50)}...", we recommend searching for specialized conferences in your field.`,
        ],
        _note: 'This is a placeholder. Connect to AI provider for real responses.',
      },
      null,
      2
    );

    return {
      content,
      citations: [],
      metadata: {
        modelUsed: this.config.modelTier,
        tokensUsed: 0,
        phiDetected: false,
        processingTimeMs: Date.now() - startTime,
      },
    };
  }
}
