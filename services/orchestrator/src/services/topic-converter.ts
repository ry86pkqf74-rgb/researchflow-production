/**
 * Topic Converter Service
 *
 * Converts Quick Entry topic fields to structured PICO format.
 * Also provides utilities for topic validation and entry mode detection.
 */

import type { Topic } from '@researchflow/core/schema';
import type { PICOElements, PICOConversionOptions } from '@researchflow/core/types/topic-declaration';

/**
 * Convert Quick Entry fields to structured PICO format
 */
export function convertQuickEntryToPICO(
  topic: Topic,
  options: PICOConversionOptions = {}
): PICOElements {
  const exposures = (topic.exposures as string[] | null) || [];
  const outcomes = (topic.outcomes as string[] | null) || [];

  // Build population from cohort inclusion/exclusion
  let population = topic.cohortInclusion || '';
  if (topic.cohortExclusion) {
    population += population ? ` excluding ${topic.cohortExclusion}` : topic.cohortExclusion;
  }

  // Use provided overrides or derive from Quick Entry fields
  return {
    population: options.population || population || 'Not specified',
    intervention: options.intervention || exposures[0] || 'Not specified',
    comparator: options.comparator || 'Standard care',
    outcomes: outcomes.length > 0 ? outcomes : ['Primary outcome'],
    timeframe: options.timeframe || extractTimeframe(topic.scope || '') || 'Study duration',
  };
}

/**
 * Extract timeframe from scope description
 * Looks for common patterns like "12-month", "1 year", "6 weeks", etc.
 */
export function extractTimeframe(scope: string): string | null {
  if (!scope) return null;

  // Common timeframe patterns
  const patterns = [
    // "12-month follow-up", "6-month period"
    /(\d+[-\s]?month(?:s)?(?:\s+follow[-\s]?up)?(?:\s+period)?)/i,
    // "1 year", "2 years"
    /(\d+\s*year(?:s)?(?:\s+follow[-\s]?up)?(?:\s+period)?)/i,
    // "6 weeks", "12 weeks"
    /(\d+\s*week(?:s)?(?:\s+follow[-\s]?up)?(?:\s+period)?)/i,
    // "90 days", "180 days"
    /(\d+\s*day(?:s)?(?:\s+follow[-\s]?up)?(?:\s+period)?)/i,
    // "short-term", "long-term"
    /((?:short|medium|long)[-\s]?term)/i,
  ];

  for (const pattern of patterns) {
    const match = scope.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Check if a topic has valid Quick Entry fields
 */
export function hasValidQuickEntryFields(topic: Topic): boolean {
  const exposures = (topic.exposures as string[] | null) || [];
  const outcomes = (topic.outcomes as string[] | null) || [];

  return Boolean(
    topic.generalTopic ||
    topic.cohortInclusion ||
    exposures.length > 0 ||
    outcomes.length > 0
  );
}

/**
 * Check if a topic has valid PICO elements
 */
export function hasValidPICOElements(topic: Topic): boolean {
  const pico = topic.picoElements as PICOElements | null;
  if (!pico) return false;

  const outcomes = Array.isArray(pico.outcomes) ? pico.outcomes : [];

  return Boolean(
    pico.population &&
    pico.intervention &&
    pico.comparator &&
    outcomes.length > 0 &&
    pico.timeframe
  );
}

/**
 * Detect the effective entry mode of a topic
 * Returns 'pico' if valid PICO elements exist, 'quick' otherwise
 */
export function detectEffectiveEntryMode(topic: Topic): 'quick' | 'pico' {
  if (hasValidPICOElements(topic)) {
    return 'pico';
  }
  return 'quick';
}

/**
 * Validate topic for research brief generation
 * Returns list of warnings/errors if topic is incomplete
 */
export function validateTopicForBriefGeneration(topic: Topic): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic required field
  if (!topic.title) {
    errors.push('Topic title is required');
  }

  const entryMode = detectEffectiveEntryMode(topic);

  if (entryMode === 'pico') {
    // Validate PICO elements
    const pico = topic.picoElements as PICOElements | null;
    if (!pico?.population) warnings.push('Population not specified in PICO elements');
    if (!pico?.intervention) warnings.push('Intervention not specified in PICO elements');
    if (!pico?.comparator) warnings.push('Comparator not specified in PICO elements');
    if (!pico?.outcomes?.length) warnings.push('No outcomes specified in PICO elements');
    if (!pico?.timeframe) warnings.push('Timeframe not specified in PICO elements');
  } else {
    // Validate Quick Entry fields
    const exposures = (topic.exposures as string[] | null) || [];
    const outcomes = (topic.outcomes as string[] | null) || [];

    if (!topic.cohortInclusion) warnings.push('Cohort inclusion criteria not specified');
    if (exposures.length === 0) warnings.push('No exposures specified');
    if (outcomes.length === 0) warnings.push('No outcomes specified');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Merge PICO conversion overrides with auto-derived values
 */
export function mergeWithOverrides(
  autoDerived: PICOElements,
  overrides: Partial<PICOElements>
): PICOElements {
  return {
    population: overrides.population || autoDerived.population,
    intervention: overrides.intervention || autoDerived.intervention,
    comparator: overrides.comparator || autoDerived.comparator,
    outcomes: overrides.outcomes?.length ? overrides.outcomes : autoDerived.outcomes,
    timeframe: overrides.timeframe || autoDerived.timeframe,
  };
}

/**
 * Get a summary of the topic for display
 */
export function getTopicSummary(topic: Topic): string {
  const entryMode = detectEffectiveEntryMode(topic);

  if (entryMode === 'pico') {
    const pico = topic.picoElements as PICOElements | null;
    if (pico) {
      return `${pico.population} | ${pico.intervention} vs ${pico.comparator} | ${pico.outcomes.join(', ')}`;
    }
  }

  // Quick Entry summary
  const exposures = (topic.exposures as string[] | null) || [];
  const outcomes = (topic.outcomes as string[] | null) || [];

  const parts: string[] = [];
  if (topic.cohortInclusion) parts.push(topic.cohortInclusion);
  if (exposures.length > 0) parts.push(exposures.join(', '));
  if (outcomes.length > 0) parts.push(`Outcomes: ${outcomes.join(', ')}`);

  return parts.length > 0 ? parts.join(' | ') : topic.title;
}
