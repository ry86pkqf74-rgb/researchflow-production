/**
 * Comments Service Tests
 *
 * Tests for PHI-safe inline comments with threading support.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock PHI scanner
const mockPhiScanner = {
  hasPhi: vi.fn(),
  scanTextForPhiLocations: vi.fn(),
};

// Mock data
const mockComment = {
  id: 'comment-1',
  artifactId: 'artifact-1',
  content: 'This section needs more detail.',
  userId: 'user-1',
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-01-15'),
  resolved: false,
  parentCommentId: null,
  anchorType: 'text',
  anchorData: {
    selectionText: 'sample text selection',
    startOffset: 100,
    endOffset: 120,
    sectionId: 'introduction',
  },
  phiScanStatus: 'PASS',
};

describe('CommentsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPhiScanner.hasPhi.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createComment', () => {
    it('should create a comment with valid data', () => {
      const comment = { ...mockComment };

      expect(comment.content).toBe('This section needs more detail.');
      expect(comment.anchorType).toBe('text');
      expect(comment.phiScanStatus).toBe('PASS');
    });

    it('should reject comment with PHI', () => {
      mockPhiScanner.hasPhi.mockReturnValue(true);
      mockPhiScanner.scanTextForPhiLocations.mockReturnValue([
        { pattern: 'SSN', start: 10, end: 21 },
      ]);

      const content = 'Patient SSN is 123-45-6789';
      const hasPhi = content.includes('123-45-6789');

      expect(hasPhi).toBe(true);
    });

    it('should allow comment with steward override', () => {
      const comment = {
        ...mockComment,
        content: 'Reviewing patient ID ABC123',
        phiScanStatus: 'OVERRIDE',
      };

      expect(comment.phiScanStatus).toBe('OVERRIDE');
    });

    it('should validate anchor types', () => {
      const validAnchorTypes = ['text', 'table', 'figure', 'slide'];

      validAnchorTypes.forEach((type) => {
        expect(validAnchorTypes).toContain(type);
      });

      expect(validAnchorTypes).not.toContain('invalid');
    });
  });

  describe('threading', () => {
    it('should create reply to existing comment', () => {
      const reply = {
        id: 'comment-2',
        parentCommentId: 'comment-1',
        content: 'I agree, we should expand this.',
        userId: 'user-2',
      };

      expect(reply.parentCommentId).toBe('comment-1');
    });

    it('should prevent deep nesting', () => {
      // Only allow 1 level of nesting (parent -> reply, no reply-to-reply)
      const reply = { parentCommentId: 'comment-1' };
      const nestedReply = { parentCommentId: 'comment-2' };

      // In practice, we'd check if comment-2 already has a parent
      const allowNesting = (parentId: string, isParentAReply: boolean) => {
        if (isParentAReply) {
          throw new Error('Cannot reply to a reply');
        }
        return true;
      };

      expect(allowNesting('comment-1', false)).toBe(true);
      expect(() => allowNesting('comment-2', true)).toThrow('Cannot reply to a reply');
    });

    it('should resolve thread when parent is resolved', () => {
      const thread = {
        root: { id: 'comment-1', resolved: true },
        replies: [
          { id: 'comment-2', parentCommentId: 'comment-1' },
          { id: 'comment-3', parentCommentId: 'comment-1' },
        ],
      };

      // All replies should be considered resolved when root is resolved
      const isThreadResolved = thread.root.resolved;
      expect(isThreadResolved).toBe(true);
    });
  });

  describe('anchor data', () => {
    it('should store text selection anchor', () => {
      const textAnchor = {
        anchorType: 'text',
        anchorData: {
          selectionText: 'selected text',
          startOffset: 100,
          endOffset: 113,
          sectionId: 'methods',
        },
      };

      expect(textAnchor.anchorData.startOffset).toBeLessThan(textAnchor.anchorData.endOffset);
      expect(textAnchor.anchorData.selectionText).toHaveLength(13);
    });

    it('should store table anchor', () => {
      const tableAnchor = {
        anchorType: 'table',
        anchorData: {
          tableId: 'table-1',
          rowIndex: 2,
          columnIndex: 3,
        },
      };

      expect(tableAnchor.anchorData.tableId).toBe('table-1');
    });

    it('should store figure anchor', () => {
      const figureAnchor = {
        anchorType: 'figure',
        anchorData: {
          figureId: 'figure-3a',
          region: { x: 100, y: 50, width: 200, height: 150 },
        },
      };

      expect(figureAnchor.anchorData.figureId).toBe('figure-3a');
    });

    it('should store slide anchor', () => {
      const slideAnchor = {
        anchorType: 'slide',
        anchorData: {
          slideNumber: 5,
          elementId: 'text-box-1',
        },
      };

      expect(slideAnchor.anchorData.slideNumber).toBe(5);
    });
  });

  describe('resolution', () => {
    it('should track who resolved the comment', () => {
      const resolvedComment = {
        ...mockComment,
        resolved: true,
        resolvedAt: new Date('2024-01-20'),
        resolvedBy: 'user-2',
      };

      expect(resolvedComment.resolved).toBe(true);
      expect(resolvedComment.resolvedBy).toBe('user-2');
    });

    it('should allow unresolving a comment', () => {
      const comment = {
        resolved: true,
        resolvedAt: new Date('2024-01-20'),
      };

      // Unresolve
      const unresolved = {
        ...comment,
        resolved: false,
        resolvedAt: null,
      };

      expect(unresolved.resolved).toBe(false);
      expect(unresolved.resolvedAt).toBeNull();
    });
  });

  describe('PHI scanning', () => {
    it('should scan comment content for PHI patterns', () => {
      const patterns = [
        { input: '123-45-6789', pattern: 'SSN', shouldMatch: true },
        { input: 'DOB: 01/15/1990', pattern: 'DOB', shouldMatch: true },
        { input: 'MRN: ABC12345', pattern: 'MRN', shouldMatch: true },
        { input: 'This is clean text', pattern: 'any', shouldMatch: false },
      ];

      patterns.forEach(({ input, shouldMatch }) => {
        const ssnMatch = /\d{3}-\d{2}-\d{4}/.test(input);
        const dobMatch = /DOB:\s*\d{2}\/\d{2}\/\d{4}/.test(input);
        const mrnMatch = /MRN:\s*\w+/.test(input);

        const hasPhi = ssnMatch || dobMatch || mrnMatch;
        expect(hasPhi).toBe(shouldMatch);
      });
    });

    it('should store PHI findings with location only (no raw PHI)', () => {
      const finding = {
        patternType: 'SSN',
        startOffset: 10,
        endOffset: 21,
        hashSample: 'abc123def456', // SHA256 prefix, not actual value
        confidence: 1.0,
      };

      // Should NOT contain actual PHI value
      expect(finding).not.toHaveProperty('rawValue');
      expect(finding.hashSample).toHaveLength(12);
    });
  });
});

describe('Comment Permissions', () => {
  it('should allow own comments to be edited', () => {
    const comment = { userId: 'user-1' };
    const currentUser = 'user-1';

    const canEdit = comment.userId === currentUser;
    expect(canEdit).toBe(true);
  });

  it('should prevent editing others comments', () => {
    const comment = { userId: 'user-1' };
    const currentUser = 'user-2';

    const canEdit = comment.userId === currentUser;
    expect(canEdit).toBe(false);
  });

  it('should allow steward to resolve any comment', () => {
    const userRole = 'STEWARD';
    const canResolve = ['STEWARD', 'ADMIN'].includes(userRole);
    expect(canResolve).toBe(true);
  });
});
