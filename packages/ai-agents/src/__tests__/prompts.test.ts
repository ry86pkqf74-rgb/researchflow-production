/**
 * Tests for Prompt Loader
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerPrompt,
  getPromptSpec,
  listPrompts,
  listPromptsByCategory,
  renderPrompt,
  clearPrompts,
  getPromptCount,
  initializeBuiltInPrompts,
  CONFERENCE_SCOUT_PROMPT,
  DATA_EXTRACTION_PROMPT,
  STATISTICAL_ANALYSIS_PROMPT,
  MANUSCRIPT_DRAFTING_PROMPT,
  RESEARCH_BRIEF_PROMPT,
} from '../prompts/loader.js';
import type { PromptSpec } from '../prompts/types.js';

describe('Prompt Loader', () => {
  beforeEach(() => {
    clearPrompts();
  });

  describe('registerPrompt', () => {
    it('should register a prompt', () => {
      const testPrompt: PromptSpec = {
        id: 'test-prompt',
        name: 'Test Prompt',
        version: '1.0.0',
        description: 'A test prompt',
        category: 'general',
        modelTier: 'MINI',
        systemPrompt: 'You are a test assistant.',
        userPromptTemplate: 'Hello {{name}}!',
        variables: [{ name: 'name', description: 'User name', required: true }],
      };

      registerPrompt(testPrompt);
      expect(getPromptCount()).toBe(1);
      expect(getPromptSpec('test-prompt')).toEqual(testPrompt);
    });

    it('should overwrite existing prompt with same ID', () => {
      const prompt1: PromptSpec = {
        id: 'same-id',
        name: 'First',
        version: '1.0.0',
        description: 'First version',
        category: 'general',
        modelTier: 'MINI',
        systemPrompt: 'First',
        userPromptTemplate: 'First',
        variables: [],
      };

      const prompt2: PromptSpec = {
        id: 'same-id',
        name: 'Second',
        version: '2.0.0',
        description: 'Second version',
        category: 'general',
        modelTier: 'STANDARD',
        systemPrompt: 'Second',
        userPromptTemplate: 'Second',
        variables: [],
      };

      registerPrompt(prompt1);
      registerPrompt(prompt2);

      expect(getPromptCount()).toBe(1);
      expect(getPromptSpec('same-id')?.name).toBe('Second');
    });
  });

  describe('getPromptSpec', () => {
    it('should return undefined for non-existent prompt', () => {
      expect(getPromptSpec('non-existent')).toBeUndefined();
    });
  });

  describe('listPrompts', () => {
    it('should return all registered prompts', () => {
      initializeBuiltInPrompts();
      const prompts = listPrompts();
      expect(prompts.length).toBeGreaterThan(0);
    });
  });

  describe('listPromptsByCategory', () => {
    it('should filter prompts by category', () => {
      initializeBuiltInPrompts();

      const analysisPrompts = listPromptsByCategory('analysis');
      expect(analysisPrompts.every((p) => p.category === 'analysis')).toBe(true);

      const manuscriptPrompts = listPromptsByCategory('manuscript');
      expect(manuscriptPrompts.every((p) => p.category === 'manuscript')).toBe(true);
    });
  });

  describe('renderPrompt', () => {
    beforeEach(() => {
      const testPrompt: PromptSpec = {
        id: 'render-test',
        name: 'Render Test',
        version: '1.0.0',
        description: 'Test rendering',
        category: 'general',
        modelTier: 'MINI',
        systemPrompt: 'You help {{role}} users.',
        userPromptTemplate: 'Task: {{task}}\nContext: {{context}}',
        variables: [
          { name: 'role', description: 'User role', required: true },
          { name: 'task', description: 'Task to perform', required: true },
          { name: 'context', description: 'Context', required: false, defaultValue: 'None' },
        ],
        metadata: { maxTokens: 1000 },
      };
      registerPrompt(testPrompt);
    });

    it('should render template with provided variables', () => {
      const result = renderPrompt('render-test', {
        role: 'researcher',
        task: 'analyze data',
        context: 'clinical trial',
      });

      expect(result).not.toBeNull();
      expect(result?.system).toBe('You help researcher users.');
      expect(result?.user).toBe('Task: analyze data\nContext: clinical trial');
    });

    it('should use default values for optional variables', () => {
      const result = renderPrompt('render-test', {
        role: 'researcher',
        task: 'analyze data',
      });

      expect(result?.user).toBe('Task: analyze data\nContext: None');
    });

    it('should throw error for missing required variables', () => {
      expect(() => {
        renderPrompt('render-test', { task: 'analyze data' });
      }).toThrow('Missing required variable: role');
    });

    it('should return null for non-existent prompt', () => {
      const result = renderPrompt('non-existent', {});
      expect(result).toBeNull();
    });

    it('should include model tier and max tokens', () => {
      const result = renderPrompt('render-test', {
        role: 'researcher',
        task: 'test',
      });

      expect(result?.modelTier).toBe('MINI');
      expect(result?.maxTokens).toBe(1000);
    });
  });

  describe('clearPrompts', () => {
    it('should remove all prompts', () => {
      initializeBuiltInPrompts();
      expect(getPromptCount()).toBeGreaterThan(0);

      clearPrompts();
      expect(getPromptCount()).toBe(0);
    });
  });
});

describe('Built-in Prompts', () => {
  beforeEach(() => {
    clearPrompts();
    initializeBuiltInPrompts();
  });

  describe('CONFERENCE_SCOUT_PROMPT', () => {
    it('should have valid structure', () => {
      expect(CONFERENCE_SCOUT_PROMPT.id).toBe('conference-scout');
      expect(CONFERENCE_SCOUT_PROMPT.category).toBe('conference');
      expect(CONFERENCE_SCOUT_PROMPT.variables.length).toBeGreaterThan(0);
    });

    it('should be renderable with required variables', () => {
      const result = renderPrompt('conference-scout', {
        topic: 'Diabetes management in primary care',
      });

      expect(result).not.toBeNull();
      expect(result?.user).toContain('Diabetes management');
    });
  });

  describe('DATA_EXTRACTION_PROMPT', () => {
    it('should have valid structure', () => {
      expect(DATA_EXTRACTION_PROMPT.id).toBe('data-extraction');
      expect(DATA_EXTRACTION_PROMPT.category).toBe('extraction');
    });

    it('should be renderable with required variables', () => {
      const result = renderPrompt('data-extraction', {
        researchQuestion: 'Does treatment X improve outcomes?',
        datasetSchema: '{"columns": ["patient_id", "treatment", "outcome"]}',
      });

      expect(result).not.toBeNull();
      expect(result?.user).toContain('treatment X');
    });
  });

  describe('STATISTICAL_ANALYSIS_PROMPT', () => {
    it('should have valid structure', () => {
      expect(STATISTICAL_ANALYSIS_PROMPT.id).toBe('statistical-analysis');
      expect(STATISTICAL_ANALYSIS_PROMPT.category).toBe('analysis');
    });

    it('should be renderable with required variables', () => {
      const result = renderPrompt('statistical-analysis', {
        researchGoal: 'Compare outcomes between groups',
        dataCharacteristics: 'Continuous outcome, binary exposure',
      });

      expect(result).not.toBeNull();
      expect(result?.user).toContain('Compare outcomes');
    });
  });

  describe('MANUSCRIPT_DRAFTING_PROMPT', () => {
    it('should have valid structure', () => {
      expect(MANUSCRIPT_DRAFTING_PROMPT.id).toBe('manuscript-drafting');
      expect(MANUSCRIPT_DRAFTING_PROMPT.category).toBe('manuscript');
      expect(MANUSCRIPT_DRAFTING_PROMPT.modelTier).toBe('FRONTIER');
    });

    it('should be renderable with required variables', () => {
      const result = renderPrompt('manuscript-drafting', {
        section: 'Methods',
        studySummary: 'A retrospective cohort study of 500 patients',
      });

      expect(result).not.toBeNull();
      expect(result?.user).toContain('Methods');
    });
  });

  describe('RESEARCH_BRIEF_PROMPT', () => {
    it('should have valid structure', () => {
      expect(RESEARCH_BRIEF_PROMPT.id).toBe('research-brief');
      expect(RESEARCH_BRIEF_PROMPT.category).toBe('general');
    });

    it('should be renderable with required variables', () => {
      const result = renderPrompt('research-brief', {
        title: 'COVID-19 Impact Study',
        objectives: 'Evaluate pandemic effects on primary care',
      });

      expect(result).not.toBeNull();
      expect(result?.user).toContain('COVID-19');
    });
  });
});

describe('Prompt PHI Safety', () => {
  beforeEach(() => {
    clearPrompts();
    initializeBuiltInPrompts();
  });

  it('all built-in prompts should be marked as PHI safe', () => {
    const prompts = listPrompts();
    for (const prompt of prompts) {
      expect(prompt.metadata?.phiSafe).toBe(true);
    }
  });

  it('system prompts should not request PHI', () => {
    const prompts = listPrompts();
    const phiKeywords = [
      'patient name',
      'social security',
      'date of birth',
      'medical record number',
      'actual data values',
    ];

    for (const prompt of prompts) {
      const systemPromptLower = prompt.systemPrompt.toLowerCase();
      for (const keyword of phiKeywords) {
        // Should not request PHI (might mention not to use it, which is ok)
        const requestsPhI =
          systemPromptLower.includes(`provide ${keyword}`) ||
          systemPromptLower.includes(`give ${keyword}`) ||
          systemPromptLower.includes(`include ${keyword}`);
        expect(requestsPhI).toBe(false);
      }
    }
  });
});
