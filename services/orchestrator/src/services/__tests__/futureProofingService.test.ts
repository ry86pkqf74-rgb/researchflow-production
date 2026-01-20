/**
 * Tests for Future-Proofing Service
 * Task 150 - Create future-proofing checklists for updates
 */

import { describe, it, expect } from 'vitest';
import {
  createUpgradeChecklist,
  getChecklist,
  listChecklists,
  updateChecklistItem,
  approveChecklist,
  getChecklistProgress,
  runAutomatedChecks,
  createDeprecationNotice,
  listDeprecations,
  getActiveDeprecations,
  registerApiVersion,
  deprecateApiVersion,
  listApiVersions,
  getCurrentApiVersion,
} from '../futureProofingService';

describe('FutureProofingService', () => {
  const userId = 'test-user';

  describe('createUpgradeChecklist', () => {
    it('should create checklist with items', () => {
      const checklist = createUpgradeChecklist('1.0.0', '2.0.0', userId);

      expect(checklist.id).toBeDefined();
      expect(checklist.fromVersion).toBe('1.0.0');
      expect(checklist.toVersion).toBe('2.0.0');
      expect(checklist.status).toBe('IN_PROGRESS');
      expect(checklist.items.length).toBeGreaterThan(0);
    });

    it('should include items from all categories', () => {
      const checklist = createUpgradeChecklist('1.0.0', '2.0.0', userId);

      const categories = new Set(checklist.items.map(i => i.category));
      expect(categories.has('DATABASE')).toBe(true);
      expect(categories.has('API')).toBe(true);
      expect(categories.has('SECURITY')).toBe(true);
    });

    it('should set priority levels', () => {
      const checklist = createUpgradeChecklist('1.0.0', '2.0.0', userId);

      expect(checklist.items.some(i => i.priority === 'HIGH')).toBe(true);
      expect(checklist.items.some(i => i.priority === 'MEDIUM')).toBe(true);
    });
  });

  describe('getChecklist', () => {
    it('should return checklist by id', () => {
      const created = createUpgradeChecklist('1.0.0', '2.0.0', userId);
      const checklist = getChecklist(created.id);

      expect(checklist).toBeDefined();
      expect(checklist?.id).toBe(created.id);
    });

    it('should return undefined for unknown checklist', () => {
      const checklist = getChecklist('non-existent');
      expect(checklist).toBeUndefined();
    });
  });

  describe('updateChecklistItem', () => {
    it('should update item status', () => {
      const checklist = createUpgradeChecklist('1.0.0', '2.0.0', userId);
      const itemId = checklist.items[0].id;

      const updated = updateChecklistItem(checklist.id, itemId, {
        status: 'PASSED',
        checkedBy: userId,
      });

      expect(updated).toBeDefined();
      const item = updated?.items.find(i => i.id === itemId);
      expect(item?.status).toBe('PASSED');
      expect(item?.checkedBy).toBe(userId);
    });

    it('should add result notes', () => {
      const checklist = createUpgradeChecklist('1.0.0', '2.0.0', userId);
      const itemId = checklist.items[0].id;

      const updated = updateChecklistItem(checklist.id, itemId, {
        status: 'PASSED',
        result: 'All migrations applied successfully',
        checkedBy: userId,
      });

      const item = updated?.items.find(i => i.id === itemId);
      expect(item?.result).toBe('All migrations applied successfully');
    });
  });

  describe('getChecklistProgress', () => {
    it('should return progress statistics', () => {
      const checklist = createUpgradeChecklist('1.0.0', '2.0.0', userId);
      const progress = getChecklistProgress(checklist.id);

      expect(progress.totalItems).toBeGreaterThan(0);
      expect(progress.completedItems).toBe(0);
      expect(progress.percentComplete).toBe(0);
    });

    it('should update progress after item completion', () => {
      const checklist = createUpgradeChecklist('1.0.0', '2.0.0', userId);
      const itemId = checklist.items[0].id;

      updateChecklistItem(checklist.id, itemId, {
        status: 'PASSED',
        checkedBy: userId,
      });

      const progress = getChecklistProgress(checklist.id);
      expect(progress.completedItems).toBe(1);
      expect(progress.percentComplete).toBeGreaterThan(0);
    });
  });

  describe('runAutomatedChecks', () => {
    it('should run automated checks', async () => {
      const checklist = createUpgradeChecklist('1.0.0', '2.0.0', userId);
      const result = await runAutomatedChecks(checklist.id, userId);

      expect(result.passed).toBeDefined();
      expect(result.failed).toBeDefined();
      expect(result.errors).toBeDefined();
    });
  });

  describe('approveChecklist', () => {
    it('should approve completed checklist', () => {
      const checklist = createUpgradeChecklist('1.0.0', '2.0.0', userId);

      // Complete all items
      checklist.items.forEach(item => {
        updateChecklistItem(checklist.id, item.id, {
          status: 'PASSED',
          checkedBy: userId,
        });
      });

      const approved = approveChecklist(checklist.id, userId);
      expect(approved?.status).toBe('APPROVED');
      expect(approved?.approvedBy).toBe(userId);
    });

    it('should throw error if items incomplete', () => {
      const checklist = createUpgradeChecklist('1.0.0', '2.0.0', userId);

      expect(() => approveChecklist(checklist.id, userId))
        .toThrow('Cannot approve');
    });
  });

  describe('createDeprecationNotice', () => {
    it('should create deprecation notice', () => {
      const notice = createDeprecationNotice({
        feature: 'legacyEndpoint',
        deprecatedIn: '2.0.0',
        reason: 'Replaced by new API',
        migration: 'Use /api/v2/endpoint instead',
      });

      expect(notice.id).toBeDefined();
      expect(notice.feature).toBe('legacyEndpoint');
      expect(notice.status).toBe('DEPRECATED');
    });

    it('should set removal version', () => {
      const notice = createDeprecationNotice({
        feature: 'oldFeature',
        deprecatedIn: '2.0.0',
        removedIn: '3.0.0',
        reason: 'Obsolete',
        migration: 'No longer needed',
      });

      expect(notice.removedIn).toBe('3.0.0');
    });
  });

  describe('getActiveDeprecations', () => {
    it('should return deprecations active for version', () => {
      createDeprecationNotice({
        feature: `active-test-${Date.now()}`,
        deprecatedIn: '1.0.0',
        reason: 'Test',
        migration: 'Test migration',
      });

      const active = getActiveDeprecations('1.5.0');
      expect(active.length).toBeGreaterThan(0);
    });
  });

  describe('registerApiVersion', () => {
    it('should register new API version', () => {
      const version = registerApiVersion({
        version: `test-${Date.now()}`,
        releasedAt: new Date().toISOString(),
        changelog: ['New features', 'Bug fixes'],
      });

      expect(version.version).toBeDefined();
      expect(version.status).toBe('CURRENT');
    });

    it('should include breaking changes', () => {
      const version = registerApiVersion({
        version: `breaking-${Date.now()}`,
        releasedAt: new Date().toISOString(),
        breakingChanges: [
          { change: 'Removed endpoint', migrationPath: 'Use new endpoint' },
        ],
      });

      expect(version.breakingChanges.length).toBe(1);
    });
  });

  describe('deprecateApiVersion', () => {
    it('should deprecate an API version', () => {
      const registered = registerApiVersion({
        version: `deprecate-${Date.now()}`,
        releasedAt: new Date().toISOString(),
      });

      const sunsetDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      const deprecated = deprecateApiVersion(registered.version, sunsetDate);

      expect(deprecated?.status).toBe('DEPRECATED');
      expect(deprecated?.sunsetDate).toBe(sunsetDate);
    });
  });

  describe('listApiVersions', () => {
    it('should return all API versions', () => {
      const versions = listApiVersions();
      expect(Array.isArray(versions)).toBe(true);
    });
  });

  describe('getCurrentApiVersion', () => {
    it('should return current version', () => {
      registerApiVersion({
        version: `current-${Date.now()}`,
        releasedAt: new Date().toISOString(),
      });

      const current = getCurrentApiVersion();
      expect(current).toBeDefined();
      expect(current?.status).toBe('CURRENT');
    });
  });
});
