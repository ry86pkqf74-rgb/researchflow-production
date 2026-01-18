/**
 * Branch Manager Service
 * Task T59: Manage versioned manuscript branches
 */

import { createHash } from 'crypto';

export interface BranchManagerRequest {
  manuscriptId: string;
  branchName: string;
  parentBranch?: string; // Branch from main or another branch
}

export interface ManuscriptBranch {
  id: string;
  manuscriptId: string;
  branchName: string;
  parentBranch: string;
  createdAt: Date;
  lastModified: Date;
  versionHash: string;
  status: 'active' | 'merged' | 'abandoned';
  description?: string;
}

export interface BranchComparison {
  branch1: string;
  branch2: string;
  differences: BranchDifference[];
  divergencePoint: Date;
  canAutoMerge: boolean;
}

export interface BranchDifference {
  section: string;
  type: 'content_change' | 'structure_change' | 'citation_change' | 'data_change';
  branch1Content: string;
  branch2Content: string;
  conflict: boolean;
}

export interface MergeResult {
  success: boolean;
  mergedBranchId: string;
  conflicts: BranchDifference[];
  autoResolved: number;
  requiresManualResolution: number;
}

/**
 * Branch Manager Service
 * Manages versioned branches of manuscripts (git-like workflow)
 */
export class BranchManagerService {
  private branches: Map<string, ManuscriptBranch> = new Map();

  async createBranch(request: BranchManagerRequest): Promise<ManuscriptBranch> {
    const parentBranch = request.parentBranch || 'main';

    // Verify parent branch exists
    const parent = await this.getBranch(request.manuscriptId, parentBranch);
    if (!parent && parentBranch !== 'main') {
      throw new Error(`Parent branch "${parentBranch}" not found`);
    }

    const branch: ManuscriptBranch = {
      id: this.generateBranchId(),
      manuscriptId: request.manuscriptId,
      branchName: request.branchName,
      parentBranch,
      createdAt: new Date(),
      lastModified: new Date(),
      versionHash: this.generateVersionHash(),
      status: 'active',
    };

    this.branches.set(branch.id, branch);

    // In production, copy manuscript content to new branch
    return branch;
  }

  async mergeBranch(
    sourceBranchId: string,
    targetBranchName: string
  ): Promise<MergeResult> {
    const sourceBranch = this.branches.get(sourceBranchId);
    if (!sourceBranch) {
      throw new Error(`Source branch ${sourceBranchId} not found`);
    }

    // Get target branch
    const targetBranch = await this.getBranch(sourceBranch.manuscriptId, targetBranchName);
    if (!targetBranch) {
      throw new Error(`Target branch "${targetBranchName}" not found`);
    }

    // Compare branches
    const comparison = await this.compareBranches(sourceBranchId, targetBranch.id);

    // Attempt auto-merge
    const conflicts = comparison.differences.filter(d => d.conflict);
    const autoResolved = comparison.differences.filter(d => !d.conflict);

    if (conflicts.length === 0) {
      // Clean merge
      sourceBranch.status = 'merged';
      targetBranch.lastModified = new Date();
      targetBranch.versionHash = this.generateVersionHash();

      return {
        success: true,
        mergedBranchId: targetBranch.id,
        conflicts: [],
        autoResolved: autoResolved.length,
        requiresManualResolution: 0,
      };
    } else {
      // Has conflicts - require manual resolution
      return {
        success: false,
        mergedBranchId: targetBranch.id,
        conflicts,
        autoResolved: autoResolved.length,
        requiresManualResolution: conflicts.length,
      };
    }
  }

  async compareBranches(branch1Id: string, branch2Id: string): Promise<BranchComparison> {
    const branch1 = this.branches.get(branch1Id);
    const branch2 = this.branches.get(branch2Id);

    if (!branch1 || !branch2) {
      throw new Error('One or both branches not found');
    }

    // In production, perform actual content comparison
    // For now, return mock structure
    const differences: BranchDifference[] = [];

    // Find common ancestor to determine divergence point
    const divergencePoint = branch1.createdAt < branch2.createdAt ? branch1.createdAt : branch2.createdAt;

    // Determine if auto-merge is possible
    const canAutoMerge = differences.filter(d => d.conflict).length === 0;

    return {
      branch1: branch1.branchName,
      branch2: branch2.branchName,
      differences,
      divergencePoint,
      canAutoMerge,
    };
  }

  async listBranches(manuscriptId: string): Promise<ManuscriptBranch[]> {
    const branches: ManuscriptBranch[] = [];

    for (const branch of this.branches.values()) {
      if (branch.manuscriptId === manuscriptId) {
        branches.push(branch);
      }
    }

    // Sort by creation date
    return branches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getBranch(manuscriptId: string, branchName: string): Promise<ManuscriptBranch | null> {
    for (const branch of this.branches.values()) {
      if (branch.manuscriptId === manuscriptId && branch.branchName === branchName) {
        return branch;
      }
    }

    // Check for main branch (always exists)
    if (branchName === 'main') {
      return {
        id: 'main',
        manuscriptId,
        branchName: 'main',
        parentBranch: '',
        createdAt: new Date(),
        lastModified: new Date(),
        versionHash: this.generateVersionHash(),
        status: 'active',
      };
    }

    return null;
  }

  async deleteBranch(branchId: string): Promise<void> {
    const branch = this.branches.get(branchId);

    if (!branch) {
      throw new Error(`Branch ${branchId} not found`);
    }

    if (branch.branchName === 'main') {
      throw new Error('Cannot delete main branch');
    }

    if (branch.status === 'active') {
      // Warn if deleting active branch
      console.warn(`Deleting active branch: ${branch.branchName}`);
    }

    this.branches.delete(branchId);
  }

  /**
   * Get branch history/changelog
   */
  async getBranchHistory(branchId: string): Promise<BranchHistoryEntry[]> {
    // In production, query version history
    return [];
  }

  /**
   * Revert branch to previous version
   */
  async revertBranch(branchId: string, versionHash: string): Promise<ManuscriptBranch> {
    const branch = this.branches.get(branchId);

    if (!branch) {
      throw new Error(`Branch ${branchId} not found`);
    }

    // In production, restore content from version hash
    branch.versionHash = versionHash;
    branch.lastModified = new Date();

    return branch;
  }

  // ========== Private Methods ==========

  private generateBranchId(): string {
    return `branch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateVersionHash(): string {
    // In production, hash actual manuscript content
    const timestamp = Date.now().toString();
    const random = Math.random().toString();
    return createHash('sha256').update(timestamp + random).digest('hex').substr(0, 16);
  }
}

export interface BranchHistoryEntry {
  versionHash: string;
  timestamp: Date;
  author: string;
  message: string;
  changedSections: string[];
}

export const branchManagerService = new BranchManagerService();
