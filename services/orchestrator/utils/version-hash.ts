import crypto from 'crypto';

export interface VersionHistoryEntry {
  version: number;
  timestamp: string;
  changes: string;
  hash: string;
  previousHash?: string;
  modifiedBy?: string;
}

export function generateContentHash(content: string | object): string {
  const normalizedContent = typeof content === 'string' 
    ? content 
    : JSON.stringify(content, Object.keys(content).sort());
  
  return crypto
    .createHash('sha256')
    .update(normalizedContent)
    .digest('hex');
}

export function generateTopicHash(topic: {
  title: string;
  description?: string | null;
  picoElements?: object | null;
  keywords?: string[] | null;
}): string {
  const normalized = {
    title: topic.title.trim().toLowerCase(),
    description: (topic.description || '').trim(),
    picoElements: topic.picoElements || {},
    keywords: (topic.keywords || []).map(k => k.toLowerCase().trim()).sort()
  };
  
  return generateContentHash(normalized);
}

export function compareVersions(hash1: string, hash2: string): boolean {
  return hash1 === hash2;
}

export function hasTopicChanged(
  currentHash: string, 
  previousHash: string
): boolean {
  return !compareVersions(currentHash, previousHash);
}

export function createVersionHistoryEntry(
  version: number,
  changes: string,
  contentHash: string,
  previousHash?: string,
  modifiedBy?: string
): VersionHistoryEntry {
  return {
    version,
    timestamp: new Date().toISOString(),
    changes,
    hash: contentHash,
    previousHash,
    modifiedBy
  };
}

export function validateHashChain(history: VersionHistoryEntry[]): {
  valid: boolean;
  brokenAt?: number;
  message?: string;
} {
  if (history.length === 0) {
    return { valid: true };
  }

  const sorted = [...history].sort((a, b) => a.version - b.version);

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const previous = sorted[i - 1];
    
    if (current.previousHash && current.previousHash !== previous.hash) {
      return {
        valid: false,
        brokenAt: current.version,
        message: `Hash chain broken at version ${current.version}. Expected previousHash ${previous.hash}, got ${current.previousHash}`
      };
    }
  }

  return { valid: true };
}

export function diffVersions(
  v1Content: object,
  v2Content: object
): {
  added: string[];
  removed: string[];
  modified: string[];
  unchanged: string[];
} {
  const v1Keys = new Set(Object.keys(v1Content));
  const v2Keys = new Set(Object.keys(v2Content));
  
  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];
  const unchanged: string[] = [];

  for (const key of v2Keys) {
    if (!v1Keys.has(key)) {
      added.push(key);
    }
  }

  for (const key of v1Keys) {
    if (!v2Keys.has(key)) {
      removed.push(key);
    }
  }

  for (const key of v1Keys) {
    if (v2Keys.has(key)) {
      const v1Value = JSON.stringify((v1Content as any)[key]);
      const v2Value = JSON.stringify((v2Content as any)[key]);
      
      if (v1Value !== v2Value) {
        modified.push(key);
      } else {
        unchanged.push(key);
      }
    }
  }

  return { added, removed, modified, unchanged };
}

export function generateVersionTag(
  version: number,
  hash: string,
  prefix: string = 'v'
): string {
  const shortHash = hash.substring(0, 8);
  return `${prefix}${version}-${shortHash}`;
}

export function parseVersionTag(tag: string): {
  version: number;
  shortHash: string;
} | null {
  const match = tag.match(/^v(\d+)-([a-f0-9]{8})$/i);
  if (!match) return null;
  
  return {
    version: parseInt(match[1], 10),
    shortHash: match[2]
  };
}

export function isVersionOutdated(
  stageExecutedWithVersion: string,
  currentTopicVersion: string
): boolean {
  return stageExecutedWithVersion !== currentTopicVersion;
}

export function getVersionDelta(
  currentVersion: number,
  stageExecutedVersion: number
): number {
  return currentVersion - stageExecutedVersion;
}

export interface VersionMetadata {
  version: number;
  versionTag: string;
  hash: string;
  createdAt: string;
  createdBy: string;
  isLocked: boolean;
  previousVersionId?: string;
}

export function createVersionMetadata(
  version: number,
  hash: string,
  createdBy: string,
  previousVersionId?: string,
  isLocked: boolean = false
): VersionMetadata {
  return {
    version,
    versionTag: generateVersionTag(version, hash),
    hash,
    createdAt: new Date().toISOString(),
    createdBy,
    isLocked,
    previousVersionId
  };
}
