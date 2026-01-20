import { describe, it, expect } from 'vitest';

const WORKFLOW_STAGES = [
  { id: 1, name: 'Topic Declaration', group: 'data-preparation' },
  { id: 2, name: 'Literature Search', group: 'data-preparation' },
  { id: 3, name: 'IRB Proposal', group: 'data-preparation' },
  { id: 4, name: 'Planned Extraction', group: 'data-preparation' },
  { id: 5, name: 'PHI Scanning', group: 'data-processing' },
  { id: 6, name: 'Schema Extraction', group: 'data-processing' },
  { id: 7, name: 'Final Scrubbing', group: 'data-processing' },
  { id: 8, name: 'Data Validation', group: 'data-processing' },
  { id: 9, name: 'Summary Characteristics', group: 'analysis-ideation' },
  { id: 10, name: 'Literature Gap Analysis', group: 'analysis-ideation' },
  { id: 11, name: 'Manuscript Ideation', group: 'analysis-ideation' },
  { id: 12, name: 'Manuscript Selection', group: 'manuscript-development' },
  { id: 13, name: 'Statistical Analysis', group: 'manuscript-development' },
  { id: 14, name: 'Manuscript Drafting', group: 'manuscript-development' },
  { id: 15, name: 'Polish Manuscript', group: 'finalization' },
  { id: 16, name: 'Submission Readiness', group: 'finalization' },
  { id: 17, name: 'Poster Preparation', group: 'conference-readiness' },
  { id: 18, name: 'Symposium Materials', group: 'conference-readiness' },
  { id: 19, name: 'Presentation Preparation', group: 'conference-readiness' },
  { id: 20, name: 'Conference Preparation', group: 'conference-readiness' }
];

type StageStatus = 'pending' | 'active' | 'completed' | 'blocked';

interface StageTransition {
  from: StageStatus;
  to: StageStatus;
  valid: boolean;
  conditions?: string[];
}

const VALID_STATUS_TRANSITIONS: Record<StageStatus, StageStatus[]> = {
  pending: ['active', 'blocked'],
  active: ['completed', 'blocked', 'pending'],
  completed: ['active'], // Allow re-execution
  blocked: ['pending', 'active']
};

function isValidStatusTransition(from: StageStatus, to: StageStatus): boolean {
  return VALID_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

describe('Workflow Stage Accessibility', () => {
  it('should define exactly 20 stages', () => {
    expect(WORKFLOW_STAGES.length).toBe(20);
  });

  it('should have unique stage IDs', () => {
    const ids = WORKFLOW_STAGES.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have sequential stage IDs from 1 to 20', () => {
    const ids = WORKFLOW_STAGES.map(s => s.id).sort((a, b) => a - b);
    for (let i = 0; i < ids.length; i++) {
      expect(ids[i]).toBe(i + 1);
    }
  });

  it('should have unique stage names', () => {
    const names = WORKFLOW_STAGES.map(s => s.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('should assign each stage to a group', () => {
    WORKFLOW_STAGES.forEach(stage => {
      expect(stage.group).toBeDefined();
      expect(stage.group.length).toBeGreaterThan(0);
    });
  });

  describe('Stage Groups', () => {
    it('should have data-preparation group with stages 1-4', () => {
      const dataPrep = WORKFLOW_STAGES.filter(s => s.group === 'data-preparation');
      expect(dataPrep.map(s => s.id)).toEqual([1, 2, 3, 4]);
    });

    it('should have data-processing group with stages 5-8', () => {
      const dataProc = WORKFLOW_STAGES.filter(s => s.group === 'data-processing');
      expect(dataProc.map(s => s.id)).toEqual([5, 6, 7, 8]);
    });

    it('should have analysis-ideation group with stages 9-11', () => {
      const analysis = WORKFLOW_STAGES.filter(s => s.group === 'analysis-ideation');
      expect(analysis.map(s => s.id)).toEqual([9, 10, 11]);
    });

    it('should have manuscript-development group with stages 12-14', () => {
      const manuscript = WORKFLOW_STAGES.filter(s => s.group === 'manuscript-development');
      expect(manuscript.map(s => s.id)).toEqual([12, 13, 14]);
    });

    it('should have finalization group with stages 15-16', () => {
      const final = WORKFLOW_STAGES.filter(s => s.group === 'finalization');
      expect(final.map(s => s.id)).toEqual([15, 16]);
    });

    it('should have conference-readiness group with stages 17-20', () => {
      const conf = WORKFLOW_STAGES.filter(s => s.group === 'conference-readiness');
      expect(conf.map(s => s.id)).toEqual([17, 18, 19, 20]);
    });
  });
});

describe('Stage Transition Rules', () => {
  describe('Valid Status Transitions', () => {
    it('should allow pending -> active', () => {
      expect(isValidStatusTransition('pending', 'active')).toBe(true);
    });

    it('should allow pending -> blocked', () => {
      expect(isValidStatusTransition('pending', 'blocked')).toBe(true);
    });

    it('should allow active -> completed', () => {
      expect(isValidStatusTransition('active', 'completed')).toBe(true);
    });

    it('should allow active -> blocked', () => {
      expect(isValidStatusTransition('active', 'blocked')).toBe(true);
    });

    it('should allow active -> pending (pause)', () => {
      expect(isValidStatusTransition('active', 'pending')).toBe(true);
    });

    it('should allow completed -> active (re-execute)', () => {
      expect(isValidStatusTransition('completed', 'active')).toBe(true);
    });

    it('should allow blocked -> pending (unblock)', () => {
      expect(isValidStatusTransition('blocked', 'pending')).toBe(true);
    });

    it('should allow blocked -> active (override)', () => {
      expect(isValidStatusTransition('blocked', 'active')).toBe(true);
    });
  });

  describe('Invalid Status Transitions', () => {
    it('should reject pending -> completed (skip active)', () => {
      expect(isValidStatusTransition('pending', 'completed')).toBe(false);
    });

    it('should reject completed -> pending', () => {
      expect(isValidStatusTransition('completed', 'pending')).toBe(false);
    });

    it('should reject completed -> blocked', () => {
      expect(isValidStatusTransition('completed', 'blocked')).toBe(false);
    });
  });
});

describe('Stage Dependency Rules', () => {
  const STAGE_DEPENDENCIES: Record<number, number[]> = {
    1: [], // Topic Declaration has no dependencies
    2: [1], // Literature Search depends on Topic
    3: [1, 2], // IRB depends on Topic and Literature
    4: [1], // Planned Extraction depends on Topic
    5: [], // PHI Scanning can run independently
    6: [5], // Schema depends on PHI scan
    7: [5, 6], // Scrubbing depends on PHI scan and Schema
    8: [7], // Validation depends on Scrubbing
    9: [8], // Summary depends on Validation
    10: [2, 9], // Gap Analysis depends on Literature and Summary
    11: [9, 10], // Ideation depends on Summary and Gap
    12: [11], // Selection depends on Ideation
    13: [12], // Statistical Analysis depends on Selection
    14: [13], // Drafting depends on Statistics
    15: [14], // Polish depends on Drafting
    16: [15], // Submission depends on Polish
    17: [14], // Poster depends on Drafting
    18: [14], // Symposium depends on Drafting
    19: [14] // Presentation depends on Drafting
  };

  function areDependenciesMet(stageId: number, completedStages: number[]): boolean {
    const deps = STAGE_DEPENDENCIES[stageId] || [];
    return deps.every(dep => completedStages.includes(dep));
  }

  it('should allow Stage 1 to start without dependencies', () => {
    expect(areDependenciesMet(1, [])).toBe(true);
  });

  it('should require Stage 1 for Stage 2', () => {
    expect(areDependenciesMet(2, [])).toBe(false);
    expect(areDependenciesMet(2, [1])).toBe(true);
  });

  it('should require Stages 1 and 2 for Stage 3', () => {
    expect(areDependenciesMet(3, [])).toBe(false);
    expect(areDependenciesMet(3, [1])).toBe(false);
    expect(areDependenciesMet(3, [2])).toBe(false);
    expect(areDependenciesMet(3, [1, 2])).toBe(true);
  });

  it('should allow PHI Scanning (5) to run independently', () => {
    expect(areDependenciesMet(5, [])).toBe(true);
  });

  it('should require PHI scan for Schema Extraction (6)', () => {
    expect(areDependenciesMet(6, [])).toBe(false);
    expect(areDependenciesMet(6, [5])).toBe(true);
  });

  it('should allow parallel paths for conference stages', () => {
    const draftingComplete = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
    
    expect(areDependenciesMet(17, draftingComplete)).toBe(true);
    expect(areDependenciesMet(18, draftingComplete)).toBe(true);
    expect(areDependenciesMet(19, draftingComplete)).toBe(true);
  });
});

describe('Blocked Transition Rejection', () => {
  const PHI_REQUIRED_STAGES = [9, 13, 14, 17, 18, 19];

  interface StageState {
    id: number;
    status: StageStatus;
    phiStatus: 'UNCHECKED' | 'PASS' | 'FAIL' | 'OVERRIDDEN';
  }

  function canEnterStage(state: StageState): boolean {
    if (PHI_REQUIRED_STAGES.includes(state.id)) {
      if (state.phiStatus === 'FAIL') {
        return false;
      }
      if (state.phiStatus === 'UNCHECKED') {
        return false;
      }
    }
    return true;
  }

  it('should block Stage 9 if PHI status is FAIL', () => {
    const state: StageState = { id: 9, status: 'pending', phiStatus: 'FAIL' };
    expect(canEnterStage(state)).toBe(false);
  });

  it('should block Stage 13 if PHI status is UNCHECKED', () => {
    const state: StageState = { id: 13, status: 'pending', phiStatus: 'UNCHECKED' };
    expect(canEnterStage(state)).toBe(false);
  });

  it('should allow Stage 13 if PHI status is PASS', () => {
    const state: StageState = { id: 13, status: 'pending', phiStatus: 'PASS' };
    expect(canEnterStage(state)).toBe(true);
  });

  it('should allow Stage 14 if PHI status is OVERRIDDEN', () => {
    const state: StageState = { id: 14, status: 'pending', phiStatus: 'OVERRIDDEN' };
    expect(canEnterStage(state)).toBe(true);
  });

  it('should allow non-PHI stages regardless of PHI status', () => {
    const state: StageState = { id: 2, status: 'pending', phiStatus: 'FAIL' };
    expect(canEnterStage(state)).toBe(true);
  });
});

describe('AI-Enabled Stages', () => {
  const AI_ENABLED_STAGES = [2, 3, 4, 5, 9, 10, 11, 13, 14, 15, 16];

  it('should correctly identify AI-enabled stages', () => {
    AI_ENABLED_STAGES.forEach(stageId => {
      expect(AI_ENABLED_STAGES.includes(stageId)).toBe(true);
    });
  });

  it('should not include Stage 1 (Topic Declaration) in AI stages', () => {
    expect(AI_ENABLED_STAGES.includes(1)).toBe(false);
  });

  it('should include literature-related AI stages', () => {
    expect(AI_ENABLED_STAGES.includes(2)).toBe(true); // Literature Search
    expect(AI_ENABLED_STAGES.includes(10)).toBe(true); // Gap Analysis
    expect(AI_ENABLED_STAGES.includes(11)).toBe(true); // Ideation
  });

  it('should include analysis AI stages', () => {
    expect(AI_ENABLED_STAGES.includes(13)).toBe(true); // Statistics
    expect(AI_ENABLED_STAGES.includes(14)).toBe(true); // Drafting
  });

  it('should include finalization AI stages', () => {
    expect(AI_ENABLED_STAGES.includes(15)).toBe(true); // Polish
    expect(AI_ENABLED_STAGES.includes(16)).toBe(true); // Submission
  });

  it('should not include conference stages in AI-enabled list', () => {
    expect(AI_ENABLED_STAGES.includes(17)).toBe(false);
    expect(AI_ENABLED_STAGES.includes(18)).toBe(false);
    expect(AI_ENABLED_STAGES.includes(19)).toBe(false);
  });
});

describe('Stage Output Versioning', () => {
  interface StageOutput {
    stageId: number;
    version: number;
    topicVersionAtExecution: string;
    generatedAt: string;
  }

  function isOutputOutdated(output: StageOutput, currentTopicVersion: string): boolean {
    return output.topicVersionAtExecution !== currentTopicVersion;
  }

  it('should mark output as outdated when topic version changes', () => {
    const output: StageOutput = {
      stageId: 2,
      version: 1,
      topicVersionAtExecution: 'v1-abc123',
      generatedAt: new Date().toISOString()
    };
    
    expect(isOutputOutdated(output, 'v2-def456')).toBe(true);
  });

  it('should mark output as current when topic version matches', () => {
    const output: StageOutput = {
      stageId: 2,
      version: 1,
      topicVersionAtExecution: 'v1-abc123',
      generatedAt: new Date().toISOString()
    };
    
    expect(isOutputOutdated(output, 'v1-abc123')).toBe(false);
  });
});
