/**
 * Diff Service
 * 
 * Computes text diffs between artifact versions using diff-match-patch.
 * Supports PHI-safe diff summaries (no raw text in responses).
 */
import { db } from "../../db";
import { artifactVersions, artifactComparisons } from "@researchflow/core/schema";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { hasPhi } from "@researchflow/phi-engine";
import crypto from "crypto";

// diff-match-patch implementation
interface DiffOp {
  operation: 'equal' | 'insert' | 'delete';
  text: string;
}

/**
 * Simple diff implementation using longest common subsequence.
 * Returns array of operations: equal, insert, delete.
 */
function computeLineDiff(fromText: string, toText: string): DiffOp[] {
  const fromLines = fromText.split('\n');
  const toLines = toText.split('\n');
  
  // Build LCS table
  const m = fromLines.length;
  const n = toLines.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (fromLines[i - 1] === toLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  // Backtrack to build diff
  const diffs: DiffOp[] = [];
  let i = m, j = n;
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && fromLines[i - 1] === toLines[j - 1]) {
      diffs.unshift({ operation: 'equal', text: fromLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diffs.unshift({ operation: 'insert', text: toLines[j - 1] });
      j--;
    } else {
      diffs.unshift({ operation: 'delete', text: fromLines[i - 1] });
      i--;
    }
  }
  
  return diffs;
}

export interface DiffResult {
  fromVersionId: string;
  toVersionId: string;
  addedLines: number;
  removedLines: number;
  unchangedLines: number;
  operations: Array<{
    operation: 'equal' | 'insert' | 'delete';
    lineCount: number;
    lineNumbers: { from?: number; to?: number }[];
    textHash?: string; // Hash of text for verification, never raw text
  }>;
  summary: string;
  containsPhi: boolean;
}

export interface DiffHunk {
  fromStart: number;
  fromCount: number;
  toStart: number;
  toCount: number;
  lines: Array<{
    type: '+' | '-' | ' ';
    content: string;
    lineNumber: number;
  }>;
}

/**
 * Compute diff between two artifact versions.
 */
export async function computeDiff(
  fromVersionId: string,
  toVersionId: string
): Promise<DiffResult | null> {
  // Fetch both versions
  const [fromVersion] = await db
    .select()
    .from(artifactVersions)
    .where(eq(artifactVersions.id, fromVersionId))
    .limit(1);

  const [toVersion] = await db
    .select()
    .from(artifactVersions)
    .where(eq(artifactVersions.id, toVersionId))
    .limit(1);

  if (!fromVersion || !toVersion) {
    return null;
  }

  const fromText = fromVersion.content;
  const toText = toVersion.content;

  // Compute line-based diff
  const diffs = computeLineDiff(fromText, toText);

  let addedLines = 0;
  let removedLines = 0;
  let unchangedLines = 0;
  let fromLineNum = 0;
  let toLineNum = 0;

  const operations: DiffResult['operations'] = [];

  for (const diff of diffs) {
    const lineCount = 1; // Each diff op is one line
    
    if (diff.operation === 'equal') {
      unchangedLines += lineCount;
      fromLineNum++;
      toLineNum++;
      operations.push({
        operation: 'equal',
        lineCount,
        lineNumbers: [{ from: fromLineNum, to: toLineNum }],
      });
    } else if (diff.operation === 'insert') {
      addedLines += lineCount;
      toLineNum++;
      operations.push({
        operation: 'insert',
        lineCount,
        lineNumbers: [{ to: toLineNum }],
        textHash: hashText(diff.text),
      });
    } else if (diff.operation === 'delete') {
      removedLines += lineCount;
      fromLineNum++;
      operations.push({
        operation: 'delete',
        lineCount,
        lineNumbers: [{ from: fromLineNum }],
        textHash: hashText(diff.text),
      });
    }
  }

  // Check if either version contains PHI
  const containsPhi = hasPhi(fromText) || hasPhi(toText);

  // Generate summary
  const summary = generateDiffSummary(addedLines, removedLines, unchangedLines);

  return {
    fromVersionId,
    toVersionId,
    addedLines,
    removedLines,
    unchangedLines,
    operations,
    summary,
    containsPhi,
  };
}

/**
 * Get unified diff hunks for display (PHI-safe).
 * Only returns actual text if explicitly requested and user has permission.
 */
export async function getUnifiedDiff(
  fromVersionId: string,
  toVersionId: string,
  options?: { includeText?: boolean; maxHunks?: number }
): Promise<DiffHunk[]> {
  const [fromVersion] = await db
    .select()
    .from(artifactVersions)
    .where(eq(artifactVersions.id, fromVersionId))
    .limit(1);

  const [toVersion] = await db
    .select()
    .from(artifactVersions)
    .where(eq(artifactVersions.id, toVersionId))
    .limit(1);

  if (!fromVersion || !toVersion) {
    return [];
  }

  const fromLines = fromVersion.content.split('\n');
  const toLines = toVersion.content.split('\n');
  const diffs = computeLineDiff(fromVersion.content, toVersion.content);

  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let fromLine = 0;
  let toLine = 0;

  for (const diff of diffs) {
    if (diff.operation !== 'equal') {
      // Start a new hunk if needed
      if (!currentHunk) {
        currentHunk = {
          fromStart: fromLine + 1,
          fromCount: 0,
          toStart: toLine + 1,
          toCount: 0,
          lines: [],
        };
      }

      if (diff.operation === 'delete') {
        fromLine++;
        currentHunk.fromCount++;
        currentHunk.lines.push({
          type: '-',
          content: options?.includeText ? diff.text : '[content hidden]',
          lineNumber: fromLine,
        });
      } else if (diff.operation === 'insert') {
        toLine++;
        currentHunk.toCount++;
        currentHunk.lines.push({
          type: '+',
          content: options?.includeText ? diff.text : '[content hidden]',
          lineNumber: toLine,
        });
      }
    } else {
      // Equal line - close current hunk if any
      if (currentHunk) {
        hunks.push(currentHunk);
        currentHunk = null;
      }
      fromLine++;
      toLine++;
    }
  }

  // Close final hunk
  if (currentHunk) {
    hunks.push(currentHunk);
  }

  // Limit hunks if requested
  const maxHunks = options?.maxHunks || 50;
  return hunks.slice(0, maxHunks);
}

/**
 * Store a comparison result in the database.
 */
export async function storeComparison(
  artifactId: string,
  fromVersionId: string,
  toVersionId: string,
  diffResult: DiffResult,
  comparedBy: string
): Promise<string> {
  const comparisonId = nanoid();

  await db.insert(artifactComparisons).values({
    id: comparisonId,
    artifactId,
    fromVersionId,
    toVersionId,
    diffSummary: diffResult.summary,
    addedLines: diffResult.addedLines,
    removedLines: diffResult.removedLines,
    comparedBy,
  });

  return comparisonId;
}

/**
 * Get stored comparison.
 */
export async function getStoredComparison(
  artifactId: string,
  fromVersionId: string,
  toVersionId: string
): Promise<{
  id: string;
  diffSummary: string;
  addedLines: number;
  removedLines: number;
  comparedAt: Date;
} | null> {
  const [row] = await db
    .select()
    .from(artifactComparisons)
    .where(and(
      eq(artifactComparisons.artifactId, artifactId),
      eq(artifactComparisons.fromVersionId, fromVersionId),
      eq(artifactComparisons.toVersionId, toVersionId)
    ))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    diffSummary: row.diffSummary,
    addedLines: row.addedLines,
    removedLines: row.removedLines,
    comparedAt: row.comparedAt,
  };
}

/**
 * Hash text for verification without exposing content.
 */
function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/**
 * Generate human-readable diff summary.
 */
function generateDiffSummary(added: number, removed: number, unchanged: number): string {
  const parts: string[] = [];
  
  if (added > 0) {
    parts.push(\`+\${added} line\${added === 1 ? '' : 's'}\`);
  }
  if (removed > 0) {
    parts.push(\`-\${removed} line\${removed === 1 ? '' : 's'}\`);
  }
  
  if (parts.length === 0) {
    return 'No changes';
  }
  
  const total = added + removed + unchanged;
  const changePercent = Math.round(((added + removed) / Math.max(total, 1)) * 100);
  
  return \`\${parts.join(', ')} (\${changePercent}% changed)\`;
}
