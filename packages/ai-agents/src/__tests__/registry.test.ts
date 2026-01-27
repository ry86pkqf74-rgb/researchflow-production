/**
 * Tests for Agent Registry
 */

import { describe, it, expect } from 'vitest';
import {
  AGENT_REGISTRY,
  STAGE_TO_AGENTS,
  STAGE_DESCRIPTIONS,
  getAgentsForStage,
  getAgentById,
  getStageDescription,
  getAllAgentIds,
} from '../registry.js';

describe('Agent Registry', () => {
  describe('AGENT_REGISTRY', () => {
    it('should contain all core agents', () => {
      // Core agents that must exist in the registry
      const coreAgents = [
        'conference-scout',
        'data-extraction',
        'data-validation',
        'statistical-analysis',
        'manuscript-drafting',
        'abstract-generator',
        'results-interpreter',
        'discussion-writer',
        'methods-writer',
        'introduction-writer',
        'research-brief',
      ];

      for (const agentId of coreAgents) {
        expect(AGENT_REGISTRY[agentId]).toBeDefined();
        expect(AGENT_REGISTRY[agentId].id).toBe(agentId);
      }
    });

    it('should have valid model tiers for all agents', () => {
      const validTiers = ['NANO', 'MINI', 'STANDARD', 'FRONTIER'];

      for (const agent of Object.values(AGENT_REGISTRY)) {
        expect(validTiers).toContain(agent.modelTier);
      }
    });

    it('should have positive maxTokens for all agents', () => {
      for (const agent of Object.values(AGENT_REGISTRY)) {
        expect(agent.maxTokens).toBeGreaterThan(0);
      }
    });

    it('should have non-empty descriptions for all agents', () => {
      for (const agent of Object.values(AGENT_REGISTRY)) {
        expect(agent.description.length).toBeGreaterThan(10);
      }
    });
  });

  describe('STAGE_TO_AGENTS', () => {
    it('should map all 20 stages', () => {
      for (let stage = 1; stage <= 20; stage++) {
        expect(STAGE_TO_AGENTS[stage]).toBeDefined();
        expect(Array.isArray(STAGE_TO_AGENTS[stage])).toBe(true);
        expect(STAGE_TO_AGENTS[stage].length).toBeGreaterThan(0);
      }
    });

    it('should only reference existing agents', () => {
      for (const [stage, agentIds] of Object.entries(STAGE_TO_AGENTS)) {
        for (const agentId of agentIds) {
          expect(AGENT_REGISTRY[agentId]).toBeDefined();
        }
      }
    });
  });

  describe('STAGE_DESCRIPTIONS', () => {
    it('should have descriptions for all 20 stages', () => {
      for (let stage = 1; stage <= 20; stage++) {
        expect(STAGE_DESCRIPTIONS[stage]).toBeDefined();
        expect(STAGE_DESCRIPTIONS[stage].length).toBeGreaterThan(5);
      }
    });
  });

  describe('getAgentsForStage', () => {
    it('should return agents for valid stages', () => {
      const stage1Agents = getAgentsForStage(1);
      expect(Array.isArray(stage1Agents)).toBe(true);
      expect(stage1Agents.length).toBeGreaterThan(0);
      expect(stage1Agents[0].id).toBeDefined();
    });

    it('should return fallback agent for invalid stage', () => {
      const invalidStageAgents = getAgentsForStage(999);
      expect(Array.isArray(invalidStageAgents)).toBe(true);
      // Should return research-brief as fallback
      expect(invalidStageAgents.some((a) => a.id === 'research-brief')).toBe(true);
    });

    it('should return AgentConfig objects with all required fields', () => {
      const agents = getAgentsForStage(5);
      for (const agent of agents) {
        expect(agent.id).toBeDefined();
        expect(agent.name).toBeDefined();
        expect(agent.description).toBeDefined();
        expect(agent.modelTier).toBeDefined();
        expect(typeof agent.phiScanRequired).toBe('boolean');
        expect(agent.maxTokens).toBeGreaterThan(0);
      }
    });
  });

  describe('getAgentById', () => {
    it('should return agent for valid ID', () => {
      const agent = getAgentById('conference-scout');
      expect(agent).toBeDefined();
      expect(agent?.id).toBe('conference-scout');
    });

    it('should return undefined for invalid ID', () => {
      const agent = getAgentById('non-existent-agent');
      expect(agent).toBeUndefined();
    });
  });

  describe('getStageDescription', () => {
    it('should return description for valid stage', () => {
      const description = getStageDescription(1);
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);
    });

    it('should return fallback for invalid stage', () => {
      const description = getStageDescription(999);
      expect(typeof description).toBe('string');
      expect(description).toBe('Unknown stage');
    });
  });

  describe('getAllAgentIds', () => {
    it('should return all agent IDs', () => {
      const ids = getAllAgentIds();
      expect(Array.isArray(ids)).toBe(true);
      expect(ids.length).toBe(Object.keys(AGENT_REGISTRY).length);
    });

    it('should return unique IDs', () => {
      const ids = getAllAgentIds();
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});

describe('Stage Groups', () => {
  it('should have data stages (1-5) with data-related agents', () => {
    for (let stage = 1; stage <= 5; stage++) {
      const agents = getAgentsForStage(stage);
      const hasDataAgent = agents.some(
        (a) =>
          a.id.includes('data') ||
          a.id.includes('extraction') ||
          a.id.includes('validation') ||
          a.id.includes('variable') ||
          a.id.includes('cohort')
      );
      expect(hasDataAgent).toBe(true);
    }
  });

  it('should have analysis stages (6-10) with analysis-related agents', () => {
    for (let stage = 6; stage <= 10; stage++) {
      const agents = getAgentsForStage(stage);
      const hasAnalysisAgent = agents.some(
        (a) =>
          a.id.includes('statistical') ||
          a.id.includes('analysis') ||
          a.id.includes('results') ||
          a.id.includes('stats') ||
          a.id.includes('model')
      );
      expect(hasAnalysisAgent).toBe(true);
    }
  });

  it('should have manuscript stages (11-15) with writing agents', () => {
    for (let stage = 11; stage <= 15; stage++) {
      const agents = getAgentsForStage(stage);
      const hasWritingAgent = agents.some(
        (a) =>
          a.id.includes('manuscript') ||
          a.id.includes('writer') ||
          a.id.includes('discussion') ||
          a.id.includes('introduction') ||
          a.id.includes('methods') ||
          a.id.includes('results') ||
          a.id.includes('abstract')
      );
      expect(hasWritingAgent).toBe(true);
    }
  });

  it('should have conference stages (16-20) with conference-related agents', () => {
    for (let stage = 16; stage <= 20; stage++) {
      const agents = getAgentsForStage(stage);
      const hasConferenceAgent = agents.some(
        (a) =>
          a.id.includes('conference') ||
          a.id.includes('abstract') ||
          a.id.includes('poster') ||
          a.id.includes('presentation')
      );
      expect(hasConferenceAgent).toBe(true);
    }
  });
});
