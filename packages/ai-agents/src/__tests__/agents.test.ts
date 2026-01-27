/**
 * Tests for AI Agents
 */

import { describe, it, expect } from 'vitest';
import { createAgent, BaseAgent } from '../index.js';
import { ConferenceScoutAgent } from '../agents/ConferenceScoutAgent.js';
import { DataExtractionAgent } from '../agents/DataExtractionAgent.js';
import { StatisticalAnalysisAgent } from '../agents/StatisticalAnalysisAgent.js';
import { ManuscriptDraftingAgent } from '../agents/ManuscriptDraftingAgent.js';

describe('Agent Factory', () => {
  describe('createAgent', () => {
    it('should create ConferenceScoutAgent', () => {
      const agent = createAgent('conference-scout');
      expect(agent).toBeInstanceOf(ConferenceScoutAgent);
      expect(agent).toBeInstanceOf(BaseAgent);
    });

    it('should create DataExtractionAgent', () => {
      const agent = createAgent('data-extraction');
      expect(agent).toBeInstanceOf(DataExtractionAgent);
    });

    it('should create StatisticalAnalysisAgent', () => {
      const agent = createAgent('statistical-analysis');
      expect(agent).toBeInstanceOf(StatisticalAnalysisAgent);
    });

    it('should create ManuscriptDraftingAgent', () => {
      const agent = createAgent('manuscript-drafting');
      expect(agent).toBeInstanceOf(ManuscriptDraftingAgent);
    });

    it('should return null for unknown agent', () => {
      const agent = createAgent('unknown-agent');
      expect(agent).toBeNull();
    });
  });
});

describe('ConferenceScoutAgent', () => {
  const agent = new ConferenceScoutAgent();

  it('should have correct config', () => {
    expect(agent.config.id).toBe('conference-scout');
    expect(agent.config.modelTier).toBe('MINI');
    expect(agent.config.phiScanRequired).toBe(false);
  });

  it('should execute queries', async () => {
    const result = await agent.execute({
      query: 'Find conferences for diabetes research',
    });

    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.metadata).toBeDefined();
    // modelUsed reports the modelTier, not agent ID
    expect(result.metadata.modelUsed).toBe('MINI');
  });

  it('should handle context in queries', async () => {
    const result = await agent.execute({
      query: 'Find relevant conferences',
      context: {
        researchTopic: 'Type 2 Diabetes',
        preferredRegion: 'North America',
      },
    });

    expect(result.content).toBeDefined();
    expect(result.metadata.processingTimeMs).toBeGreaterThanOrEqual(0);
  });
});

describe('DataExtractionAgent', () => {
  const agent = new DataExtractionAgent();

  it('should have correct config', () => {
    expect(agent.config.id).toBe('data-extraction');
    expect(agent.config.modelTier).toBe('STANDARD');
    expect(agent.config.phiScanRequired).toBe(true);
  });

  it('should execute queries', async () => {
    const result = await agent.execute({
      query: 'Help me extract patient demographics',
      context: {
        schema: {
          columns: ['age', 'gender', 'diagnosis'],
        },
      },
    });

    expect(result.content).toBeDefined();
    expect(result.metadata.phiDetected).toBe(false);
  });

  it('should include PHI detection metadata', async () => {
    const result = await agent.execute({
      query: 'Extract data',
    });

    expect(typeof result.metadata.phiDetected).toBe('boolean');
  });
});

describe('StatisticalAnalysisAgent', () => {
  const agent = new StatisticalAnalysisAgent();

  it('should have correct config', () => {
    expect(agent.config.id).toBe('statistical-analysis');
    // Statistical analysis uses FRONTIER tier for complex reasoning
    expect(agent.config.modelTier).toBe('FRONTIER');
  });

  it('should execute analysis queries', async () => {
    const result = await agent.execute({
      query: 'What statistical test should I use to compare means?',
      context: {
        dataType: 'continuous',
        groups: 2,
      },
    });

    expect(result.content).toBeDefined();
  });
});

describe('ManuscriptDraftingAgent', () => {
  const agent = new ManuscriptDraftingAgent();

  it('should have correct config', () => {
    expect(agent.config.id).toBe('manuscript-drafting');
    expect(agent.config.modelTier).toBe('FRONTIER');
    expect(agent.config.maxTokens).toBeGreaterThan(2000);
  });

  it('should execute drafting queries', async () => {
    const result = await agent.execute({
      query: 'Help me write the introduction section',
      context: {
        studyType: 'cohort study',
        topic: 'diabetes outcomes',
      },
    });

    expect(result.content).toBeDefined();
  });
});

describe('BaseAgent Interface', () => {
  const agents = [
    new ConferenceScoutAgent(),
    new DataExtractionAgent(),
    new StatisticalAnalysisAgent(),
    new ManuscriptDraftingAgent(),
  ];

  it('all agents should have config with required fields', () => {
    for (const agent of agents) {
      expect(agent.config.id).toBeDefined();
      expect(agent.config.name).toBeDefined();
      expect(agent.config.description).toBeDefined();
      expect(agent.config.modelTier).toBeDefined();
      expect(typeof agent.config.phiScanRequired).toBe('boolean');
      expect(agent.config.maxTokens).toBeGreaterThan(0);
    }
  });

  it('all agents should implement execute', async () => {
    for (const agent of agents) {
      const result = await agent.execute({ query: 'test query' });
      expect(result.content).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.modelUsed).toBeDefined();
      expect(typeof result.metadata.tokensUsed).toBe('number');
      expect(typeof result.metadata.phiDetected).toBe('boolean');
      expect(typeof result.metadata.processingTimeMs).toBe('number');
    }
  });

  it('all agents should return valid AgentOutput', async () => {
    for (const agent of agents) {
      const result = await agent.execute({ query: 'validation test' });

      // Content should be a non-empty string
      expect(typeof result.content).toBe('string');
      expect(result.content.length).toBeGreaterThan(0);

      // Metadata should have required fields
      expect(result.metadata.processingTimeMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('all agents should validate input', () => {
    for (const agent of agents) {
      expect(agent.validateInput({ query: 'valid query' })).toBe(true);
      expect(agent.validateInput({ query: '' })).toBe(false);
    }
  });
});
