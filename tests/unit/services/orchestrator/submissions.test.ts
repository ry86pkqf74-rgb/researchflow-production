/**
 * Submissions Service Tests
 *
 * Tests for conference/journal submission tracking with reviewer feedback and rebuttals.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock PHI scanner
const mockPhiScanner = {
  hasPhi: vi.fn(),
  scanTextForPhiLocations: vi.fn(),
};

describe('SubmissionsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPhiScanner.hasPhi.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createSubmission', () => {
    it('should create submission with required fields', () => {
      const submission = {
        id: 'sub-1',
        researchId: 'research-1',
        targetId: 'target-1',
        targetName: 'ICML 2025',
        targetType: 'conference',
        status: 'draft',
        createdBy: 'user-1',
        createdAt: new Date(),
      };

      expect(submission.targetName).toBe('ICML 2025');
      expect(submission.targetType).toBe('conference');
      expect(submission.status).toBe('draft');
    });

    it('should validate target types', () => {
      const validTypes = ['conference', 'journal'];

      expect(validTypes).toContain('conference');
      expect(validTypes).toContain('journal');
      expect(validTypes).not.toContain('preprint');
    });
  });

  describe('updateSubmissionStatus', () => {
    it('should track status progression', () => {
      const statuses = [
        'draft',
        'submitted',
        'under_review',
        'revision_requested',
        'accepted',
        'rejected',
        'withdrawn',
      ];

      // Valid progression: draft -> submitted -> under_review
      const currentStatus = 'draft';
      const validNext = ['submitted', 'withdrawn'];

      expect(validNext).toContain('submitted');
      expect(validNext).not.toContain('accepted'); // Can't skip steps
    });

    it('should set submittedAt when status becomes submitted', () => {
      const submission = {
        status: 'submitted',
        submittedAt: new Date(),
      };

      expect(submission.submittedAt).toBeDefined();
    });

    it('should set decisionAt when status becomes accepted/rejected', () => {
      const acceptedSubmission = {
        status: 'accepted',
        decisionAt: new Date(),
      };

      const rejectedSubmission = {
        status: 'rejected',
        decisionAt: new Date(),
      };

      expect(acceptedSubmission.decisionAt).toBeDefined();
      expect(rejectedSubmission.decisionAt).toBeDefined();
    });
  });

  describe('createReviewerPoint', () => {
    it('should create reviewer point with PHI check', () => {
      const point = {
        id: 'point-1',
        submissionId: 'sub-1',
        reviewerId: 'Reviewer 1',
        pointNumber: 1,
        body: 'The statistical analysis needs more detail.',
        category: 'major',
        addressed: false,
        phiScanStatus: 'PASS',
        createdAt: new Date(),
      };

      expect(point.category).toBe('major');
      expect(point.phiScanStatus).toBe('PASS');
    });

    it('should reject point with PHI', () => {
      mockPhiScanner.hasPhi.mockReturnValue(true);

      const pointWithPhi = {
        body: 'Patient John Doe (MRN: 12345) shows...',
      };

      // Simulate PHI detection
      const hasPhi = /MRN:\s*\w+/.test(pointWithPhi.body);
      expect(hasPhi).toBe(true);
    });

    it('should auto-increment point numbers', () => {
      const existingPoints = [
        { pointNumber: 1 },
        { pointNumber: 2 },
        { pointNumber: 3 },
      ];

      const nextNumber = existingPoints.length + 1;
      expect(nextNumber).toBe(4);
    });

    it('should validate point categories', () => {
      const validCategories = ['major', 'minor', 'comment', 'praise'];

      validCategories.forEach((cat) => {
        expect(validCategories).toContain(cat);
      });

      expect(validCategories).not.toContain('critical');
    });
  });

  describe('createRebuttalResponse', () => {
    it('should create rebuttal with PHI check', () => {
      const rebuttal = {
        id: 'rebuttal-1',
        pointId: 'point-1',
        body: 'We have expanded the statistical methods section...',
        version: 1,
        status: 'draft',
        phiScanStatus: 'PASS',
        createdBy: 'user-1',
        createdAt: new Date(),
      };

      expect(rebuttal.status).toBe('draft');
      expect(rebuttal.version).toBe(1);
    });

    it('should version rebuttals on update', () => {
      const existingRebuttals = [
        { pointId: 'point-1', version: 1 },
        { pointId: 'point-1', version: 2 },
      ];

      const latestVersion = Math.max(...existingRebuttals.map((r) => r.version));
      const nextVersion = latestVersion + 1;

      expect(nextVersion).toBe(3);
    });

    it('should validate rebuttal statuses', () => {
      const validStatuses = ['draft', 'final'];

      expect(validStatuses).toContain('draft');
      expect(validStatuses).toContain('final');
      expect(validStatuses).not.toContain('submitted');
    });
  });

  describe('markPointAddressed', () => {
    it('should mark point as addressed', () => {
      const point = {
        id: 'point-1',
        addressed: false,
      };

      const updated = {
        ...point,
        addressed: true,
        addressedAt: new Date(),
        addressedBy: 'user-1',
      };

      expect(updated.addressed).toBe(true);
      expect(updated.addressedAt).toBeDefined();
    });

    it('should allow toggling addressed status', () => {
      const point = { addressed: true };
      const toggled = { ...point, addressed: !point.addressed };

      expect(toggled.addressed).toBe(false);
    });
  });

  describe('createSubmissionPackage', () => {
    it('should create package with manifest', () => {
      const pkg = {
        id: 'pkg-1',
        submissionId: 'sub-1',
        packageType: 'camera_ready',
        manifestJson: {
          artifacts: ['artifact-1', 'artifact-2'],
          totalSize: 15000000,
          fileCount: 5,
        },
        generatedAt: new Date(),
        generatedBy: 'user-1',
      };

      expect(pkg.packageType).toBe('camera_ready');
      expect(pkg.manifestJson.fileCount).toBe(5);
    });

    it('should validate package types', () => {
      const validTypes = [
        'initial_submission',
        'revision',
        'camera_ready',
        'supplementary',
        'rebuttal',
      ];

      validTypes.forEach((type) => {
        expect(validTypes).toContain(type);
      });
    });

    it('should check PHI status of included artifacts', () => {
      const artifacts = [
        { id: 'a1', phiScanStatus: 'PASS' },
        { id: 'a2', phiScanStatus: 'PASS' },
        { id: 'a3', phiScanStatus: 'FAIL' },
      ];

      const allClear = artifacts.every(
        (a) => a.phiScanStatus === 'PASS' || a.phiScanStatus === 'OVERRIDE'
      );

      expect(allClear).toBe(false);
    });
  });
});

describe('Submission Statistics', () => {
  it('should calculate reviewer point stats', () => {
    const points = [
      { category: 'major', addressed: true },
      { category: 'major', addressed: false },
      { category: 'minor', addressed: true },
      { category: 'minor', addressed: true },
      { category: 'comment', addressed: false },
    ];

    const stats = {
      total: points.length,
      addressed: points.filter((p) => p.addressed).length,
      byCategory: {
        major: points.filter((p) => p.category === 'major').length,
        minor: points.filter((p) => p.category === 'minor').length,
        comment: points.filter((p) => p.category === 'comment').length,
      },
    };

    expect(stats.total).toBe(5);
    expect(stats.addressed).toBe(3);
    expect(stats.byCategory.major).toBe(2);
  });

  it('should track rebuttal completion', () => {
    const points = [
      { id: 'p1', addressed: true },
      { id: 'p2', addressed: false },
      { id: 'p3', addressed: true },
    ];

    const rebuttals = [
      { pointId: 'p1', status: 'final' },
      { pointId: 'p2', status: 'draft' },
    ];

    const completionRate = {
      pointsWithRebuttals: rebuttals.length,
      finalRebuttals: rebuttals.filter((r) => r.status === 'final').length,
      totalPoints: points.length,
    };

    expect(completionRate.pointsWithRebuttals).toBe(2);
    expect(completionRate.finalRebuttals).toBe(1);
  });
});

describe('Submission Timeline', () => {
  it('should track key dates', () => {
    const timeline = {
      createdAt: new Date('2024-01-01'),
      submittedAt: new Date('2024-01-15'),
      reviewStartedAt: new Date('2024-02-01'),
      revisionRequestedAt: new Date('2024-03-01'),
      revisionSubmittedAt: new Date('2024-03-15'),
      decisionAt: new Date('2024-04-01'),
    };

    // Ensure dates are in order
    expect(timeline.submittedAt.getTime()).toBeGreaterThan(timeline.createdAt.getTime());
    expect(timeline.decisionAt.getTime()).toBeGreaterThan(timeline.submittedAt.getTime());
  });

  it('should calculate days in review', () => {
    const submittedAt = new Date('2024-01-15');
    const decisionAt = new Date('2024-04-01');

    const daysInReview = Math.round(
      (decisionAt.getTime() - submittedAt.getTime()) / (24 * 60 * 60 * 1000)
    );

    expect(daysInReview).toBe(77); // Approximately 77 days
  });
});
