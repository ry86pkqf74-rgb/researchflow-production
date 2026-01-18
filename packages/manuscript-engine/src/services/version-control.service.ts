/**
 * Version Control Service
 * Track manuscript versions with data snapshot hashes
 */

import { nanoid } from 'nanoid';
import type { ManuscriptVersion, SectionContent, IMRaDSection } from '../types';

export interface VersionDiff {
  section: IMRaDSection;
  changes: {
    type: 'added' | 'removed' | 'modified';
    description: string;
  }[];
}

/**
 * Version Control Service - Manage manuscript versions
 */
export class VersionControlService {
  private static instance: VersionControlService;
  private versions: Map<string, ManuscriptVersion> = new Map();

  private constructor() {}

  static getInstance(): VersionControlService {
    if (!this.instance) {
      this.instance = new VersionControlService();
    }
    return this.instance;
  }

  /**
   * Create new version
   */
  createVersion(
    manuscriptId: string,
    content: Record<IMRaDSection, SectionContent>,
    dataSnapshotHash: string,
    createdBy: string,
    changeDescription: string
  ): ManuscriptVersion {
    // Get version number
    const existingVersions = Array.from(this.versions.values())
      .filter(v => v.manuscriptId === manuscriptId)
      .sort((a, b) => b.versionNumber - a.versionNumber);

    const versionNumber = existingVersions.length > 0
      ? existingVersions[0].versionNumber + 1
      : 1;

    const version: ManuscriptVersion = {
      id: nanoid(),
      manuscriptId,
      versionNumber,
      content,
      dataSnapshotHash,
      createdAt: new Date(),
      createdBy,
      changeDescription,
    };

    this.versions.set(version.id, version);
    return version;
  }

  /**
   * Get version by ID
   */
  getVersion(versionId: string): ManuscriptVersion | undefined {
    return this.versions.get(versionId);
  }

  /**
   * List all versions for manuscript
   */
  listVersions(manuscriptId: string): ManuscriptVersion[] {
    return Array.from(this.versions.values())
      .filter(v => v.manuscriptId === manuscriptId)
      .sort((a, b) => b.versionNumber - a.versionNumber);
  }

  /**
   * Get latest version
   */
  getLatestVersion(manuscriptId: string): ManuscriptVersion | undefined {
    const versions = this.listVersions(manuscriptId);
    return versions[0];
  }

  /**
   * Generate diff between two versions
   */
  generateDiff(fromVersionId: string, toVersionId: string): VersionDiff[] {
    const fromVersion = this.versions.get(fromVersionId);
    const toVersion = this.versions.get(toVersionId);

    if (!fromVersion || !toVersion) {
      throw new Error('Version not found');
    }

    const diffs: VersionDiff[] = [];
    const sections: IMRaDSection[] = ['abstract', 'introduction', 'methods', 'results', 'discussion', 'references'];

    for (const section of sections) {
      const fromContent = fromVersion.content[section];
      const toContent = toVersion.content[section];

      if (!fromContent && !toContent) continue;

      const changes: VersionDiff['changes'] = [];

      if (!fromContent && toContent) {
        changes.push({
          type: 'added',
          description: `Section added with ${toContent.wordCount} words`,
        });
      } else if (fromContent && !toContent) {
        changes.push({
          type: 'removed',
          description: `Section removed (was ${fromContent.wordCount} words)`,
        });
      } else if (fromContent && toContent) {
        if (fromContent.content !== toContent.content) {
          const wordDiff = toContent.wordCount - fromContent.wordCount;
          changes.push({
            type: 'modified',
            description: `Content modified (${wordDiff > 0 ? '+' : ''}${wordDiff} words)`,
          });
        }
      }

      if (changes.length > 0) {
        diffs.push({ section, changes });
      }
    }

    return diffs;
  }

  /**
   * Rollback to previous version
   */
  rollback(manuscriptId: string, targetVersionId: string, createdBy: string): ManuscriptVersion {
    const targetVersion = this.versions.get(targetVersionId);
    if (!targetVersion) {
      throw new Error('Target version not found');
    }

    // Create new version with content from target
    return this.createVersion(
      manuscriptId,
      targetVersion.content,
      targetVersion.dataSnapshotHash,
      createdBy,
      `Rolled back to version ${targetVersion.versionNumber}`
    );
  }
}

/**
 * Factory function
 */
export function getVersionControl(): VersionControlService {
  return VersionControlService.getInstance();
}
