/**
 * PHI Sanitizer Service
 * CRITICAL GOVERNANCE: Strips any suspicious PHI-related fields from outputs
 *
 * This is the final line of defense to ensure NO PHI values leak in API responses.
 */

/**
 * Fields that should NEVER appear in API responses
 * These may contain PHI values
 */
const FORBIDDEN_FIELDS = new Set([
  'context',        // PHI scan context snippets
  'value',          // Matched PHI values
  'matchedText',    // Plagiarism matched text
  'raw',            // Raw content
  'text',           // Generic text fields in PHI results
  'snippet',        // Context snippets
  'excerpt',        // Text excerpts
  'content',        // When in detection context
  'matchedValue',   // Matched values
  'detectedValue',  // Detected values
  'originalText',   // Original text before redaction
]);

/**
 * Fields that are safe and should be preserved
 */
const SAFE_FIELDS = new Set([
  'section',
  'type',
  'pattern',
  'startIndex',
  'endIndex',
  'severity',
  'recommendation',
  'detectionId',
  'sourceId',
  'sourceTitle',
  'matchedTextLocation',
  'matchedTextLength',
  'matchedTextHash',
  'similarityScore',
  'ngramSize',
  'matchType',
  'isCited',
  'passed',
  'manuscriptId',
  'scanTimestamp',
  'totalScanned',
  'attestationRequired',
  'auditHash',
  'blocked',
  'requiresApproval',
]);

/**
 * Recursively sanitize an object by removing forbidden PHI-containing fields
 *
 * @param obj The object to sanitize
 * @param depth Current recursion depth (prevents infinite loops)
 * @returns Sanitized object with PHI fields removed
 */
export function sanitizePhiFindings<T>(obj: T, depth = 0): T {
  // Prevent infinite recursion
  if (depth > 10) {
    return obj;
  }

  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle primitives
  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizePhiFindings(item, depth + 1)) as unknown as T;
  }

  // Handle objects
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    // Skip forbidden fields
    if (FORBIDDEN_FIELDS.has(key.toLowerCase())) {
      console.warn(`[PHI-SANITIZE] Removed forbidden field: ${key}`);
      continue;
    }

    // Recursively sanitize nested objects
    sanitized[key] = sanitizePhiFindings(value, depth + 1);
  }

  return sanitized as T;
}

/**
 * Sanitize plagiarism results specifically
 * Ensures no matched text content is exposed
 */
export function sanitizePlagiarismResults(results: unknown): unknown {
  if (!results || typeof results !== 'object') {
    return results;
  }

  const sanitized = sanitizePhiFindings(results);

  // Additional check for matches array
  if (Array.isArray((sanitized as any).matches)) {
    (sanitized as any).matches = (sanitized as any).matches.map((match: any) => {
      // Ensure no text content
      const { matchedText, text, content, snippet, ...safe } = match;
      return safe;
    });
  }

  return sanitized;
}

/**
 * Sanitize claim verification results
 * Removes any context that might contain PHI
 */
export function sanitizeClaimResults(results: unknown): unknown {
  if (!results || typeof results !== 'object') {
    return results;
  }

  const sanitized = sanitizePhiFindings(results);

  // Additional check for claims array
  if (Array.isArray((sanitized as any).claims)) {
    (sanitized as any).claims = (sanitized as any).claims.map((claim: any) => {
      // Keep only safe claim fields
      return {
        claimId: claim.claimId,
        section: claim.section,
        startIndex: claim.startIndex,
        endIndex: claim.endIndex,
        verified: claim.verified,
        confidence: claim.confidence,
        supportingCitations: claim.supportingCitations,
        recommendation: claim.recommendation,
        // Explicitly exclude: claimText, context, excerpt
      };
    });
  }

  return sanitized;
}

/**
 * Sanitize export metadata
 * Ensures no PHI in export metadata responses
 */
export function sanitizeExportMetadata(metadata: unknown): unknown {
  if (!metadata || typeof metadata !== 'object') {
    return metadata;
  }

  return sanitizePhiFindings(metadata);
}

/**
 * Validate that an object doesn't contain forbidden fields
 * Throws if forbidden fields are found
 */
export function validateNoPhiFields(obj: unknown, context: string): void {
  if (!obj || typeof obj !== 'object') {
    return;
  }

  const checkObject = (o: unknown, path: string): void => {
    if (!o || typeof o !== 'object') {
      return;
    }

    if (Array.isArray(o)) {
      o.forEach((item, index) => checkObject(item, `${path}[${index}]`));
      return;
    }

    for (const [key, value] of Object.entries(o as Record<string, unknown>)) {
      if (FORBIDDEN_FIELDS.has(key.toLowerCase())) {
        const error = `[PHI-VALIDATE] Forbidden field "${key}" found at ${path}.${key} in ${context}`;
        console.error(error);
        throw new Error(error);
      }
      checkObject(value, `${path}.${key}`);
    }
  };

  checkObject(obj, 'root');
}
