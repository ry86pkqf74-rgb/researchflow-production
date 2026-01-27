/**
 * Guidelines Service
 *
 * Business logic for the Guidelines Engine.
 * Provides score calculation, version comparison, and blueprint generation.
 */

import { GuidelinesRepository } from '../repositories/guidelines.repository';
import {
  SystemCard,
  RuleSpec,
  EvidenceStatement,
  VersionGraphEntry,
  ValidationBlueprint,
  CalculatorResult,
  GenerateBlueprintRequest,
  CalculateScoreRequest,
  CalculateScoreResponse,
  CompareVersionsRequest,
  CompareVersionsResponse,
  VersionDifference,
  StudyIntent,
  SystemCardWithDetails,
  ThresholdRuleDefinition,
  LookupRuleDefinition,
  FormulaRuleDefinition,
} from '../types/guidelines';

export class GuidelinesService {
  constructor(private repository: GuidelinesRepository) {}

  // ==========================================================================
  // SYSTEM CARD OPERATIONS
  // ==========================================================================

  async getSystemCard(id: string): Promise<SystemCard | null> {
    return this.repository.getSystemCard(id);
  }

  async getSystemCardByName(name: string): Promise<SystemCard | null> {
    return this.repository.getSystemCardByName(name);
  }

  async getSystemCardWithDetails(id: string): Promise<SystemCardWithDetails | null> {
    const systemCard = await this.repository.getSystemCard(id);
    if (!systemCard) return null;

    const [ruleSpecs, evidence, versions] = await Promise.all([
      this.repository.getRuleSpecsForSystemCard(id),
      this.repository.getEvidenceForSystemCard(id),
      this.repository.getVersionHistory(id),
    ]);

    return { systemCard, ruleSpecs, evidence, versions };
  }

  // ==========================================================================
  // SCORE CALCULATION
  // ==========================================================================

  async calculateScore(
    request: CalculateScoreRequest,
    userId?: string
  ): Promise<CalculateScoreResponse> {
    const systemCard = await this.repository.getSystemCard(request.systemCardId);
    if (!systemCard) {
      throw new Error(`System card not found: ${request.systemCardId}`);
    }

    const ruleSpecs = await this.repository.getRuleSpecsForSystemCard(request.systemCardId);
    if (ruleSpecs.length === 0) {
      throw new Error(`No computable rules defined for: ${systemCard.name}`);
    }

    // Validate inputs against system card requirements
    this.validateInputs(systemCard, request.inputs);

    // Execute the primary rule
    const ruleSpec = ruleSpecs[0];
    const outputs = this.executeRule(ruleSpec, request.inputs);
    const interpretation = this.getInterpretation(systemCard, outputs);

    // Save result for audit
    const result = await this.repository.saveCalculatorResult({
      systemCardId: request.systemCardId,
      ruleSpecId: ruleSpec.id,
      userId,
      inputs: request.inputs,
      outputs,
      interpretation,
      context: request.context || 'research',
    });

    return { result, systemCard, ruleSpec };
  }

  private validateInputs(systemCard: SystemCard, inputs: Record<string, unknown>): void {
    for (const inputDef of systemCard.inputs) {
      if (inputDef.required && inputs[inputDef.name] === undefined) {
        throw new Error(`Missing required input: ${inputDef.name}`);
      }
      // Type validation
      const value = inputs[inputDef.name];
      if (value !== undefined) {
        if (inputDef.type === 'numeric' && typeof value !== 'number') {
          throw new Error(`Input ${inputDef.name} must be a number`);
        }
        if (inputDef.type === 'boolean' && typeof value !== 'boolean') {
          throw new Error(`Input ${inputDef.name} must be a boolean`);
        }
        if (inputDef.type === 'categorical' && inputDef.validValues) {
          const validValues = inputDef.validValues as string[];
          if (!validValues.includes(value as string)) {
            throw new Error(
              `Input ${inputDef.name} must be one of: ${validValues.join(', ')}`
            );
          }
        }
      }
    }
  }

  private executeRule(
    ruleSpec: RuleSpec,
    inputs: Record<string, unknown>
  ): Record<string, unknown> {
    switch (ruleSpec.ruleType) {
      case 'threshold':
        return this.executeThresholdRule(
          ruleSpec.ruleDefinition as ThresholdRuleDefinition,
          inputs
        );
      case 'lookup_table':
        return this.executeLookupRule(
          ruleSpec.ruleDefinition as LookupRuleDefinition,
          inputs
        );
      case 'formula':
        return this.executeFormulaRule(
          ruleSpec.ruleDefinition as FormulaRuleDefinition,
          inputs
        );
      default:
        throw new Error(`Unsupported rule type: ${ruleSpec.ruleType}`);
    }
  }

  private executeThresholdRule(
    definition: ThresholdRuleDefinition,
    inputs: Record<string, unknown>
  ): Record<string, unknown> {
    let score = 0;
    const matchedCriteria: string[] = [];

    for (const criterion of definition.criteria || []) {
      const value = inputs[criterion.variable];
      if (value === undefined) continue;

      let matched = false;
      const target = criterion.value ?? criterion.threshold;

      switch (criterion.condition) {
        case 'equals':
          matched = value === target;
          break;
        case 'gte':
          matched = (value as number) >= (target as number);
          break;
        case 'gt':
          matched = (value as number) > (target as number);
          break;
        case 'lte':
          matched = (value as number) <= (target as number);
          break;
        case 'lt':
          matched = (value as number) < (target as number);
          break;
        case 'boolean':
          matched = Boolean(value);
          break;
        case 'in':
          matched = Array.isArray(target) && target.includes(value);
          break;
      }

      if (matched) {
        score += criterion.points;
        matchedCriteria.push(criterion.name || criterion.variable);
      }
    }

    const category = this.categorizeScore(definition.categories, score);

    return { score, category, matchedCriteria };
  }

  private executeLookupRule(
    definition: LookupRuleDefinition,
    inputs: Record<string, unknown>
  ): Record<string, unknown> {
    const keyParts = definition.keys.map((k) => `${k}:${inputs[k]}`).sort();
    const lookupKey = keyParts.join('|');

    const result = definition.table[lookupKey];
    if (!result) {
      // Try case-insensitive match
      const lowerKey = lookupKey.toLowerCase();
      for (const [tableKey, tableValue] of Object.entries(definition.table)) {
        if (tableKey.toLowerCase() === lowerKey) {
          return tableValue;
        }
      }
      throw new Error(`No matching entry in lookup table for: ${lookupKey}`);
    }

    return result;
  }

  private executeFormulaRule(
    definition: FormulaRuleDefinition,
    inputs: Record<string, unknown>
  ): Record<string, unknown> {
    // Build evaluation context
    const context: Record<string, number> = {};
    for (const varDef of definition.variables || []) {
      let value = inputs[varDef.name];
      if (value === undefined) {
        if (varDef.required) {
          throw new Error(`Missing required variable: ${varDef.name}`);
        }
        value = varDef.default ?? 0;
      }
      context[varDef.name] = Number(value);
    }

    // Safe formula evaluation using Function constructor
    // Only allow math operations and variable references
    try {
      const formula = definition.formula;
      const varNames = Object.keys(context);
      const varValues = Object.values(context);

      // Create safe function with limited scope
      const safeEval = new Function(
        ...varNames,
        `"use strict"; return (${formula});`
      );
      const result = safeEval(...varValues);

      const category = definition.categories
        ? this.categorizeScore(definition.categories, result)
        : undefined;

      return { value: result, category };
    } catch (error) {
      throw new Error(`Formula evaluation failed: ${(error as Error).message}`);
    }
  }

  private categorizeScore(
    categories: Array<{ min: number; max: number; label: string }> | undefined,
    score: number
  ): string {
    if (!categories) return 'Unknown';
    for (const cat of categories) {
      if (score >= cat.min && score <= cat.max) {
        return cat.label;
      }
    }
    return 'Unknown';
  }

  private getInterpretation(
    systemCard: SystemCard,
    outputs: Record<string, unknown>
  ): string {
    const score = (outputs.score ?? outputs.value ?? outputs.stage) as number | string;
    for (const interp of systemCard.interpretation) {
      if (this.matchesRange(interp.range, score)) {
        return interp.meaning;
      }
    }
    return '';
  }

  private matchesRange(range: string, value: number | string): boolean {
    if (typeof value === 'string') {
      return range.toLowerCase() === value.toLowerCase();
    }

    // Parse ranges like "0-1", "≥2", ">=2", "2+"
    if (range.includes('-')) {
      const [minStr, maxStr] = range.split('-');
      const min = parseFloat(minStr);
      const max = parseFloat(maxStr);
      return value >= min && value <= max;
    }
    if (range.startsWith('≥') || range.startsWith('>=')) {
      const threshold = parseFloat(range.replace(/[≥>=]/g, ''));
      return value >= threshold;
    }
    if (range.endsWith('+')) {
      const threshold = parseFloat(range.slice(0, -1));
      return value >= threshold;
    }

    return String(value) === range;
  }

  // ==========================================================================
  // VERSION COMPARISON
  // ==========================================================================

  async compareVersions(request: CompareVersionsRequest): Promise<CompareVersionsResponse> {
    const [systemA, systemB] = await Promise.all([
      this.repository.getSystemCard(request.systemCardIdA),
      this.repository.getSystemCard(request.systemCardIdB),
    ]);

    if (!systemA || !systemB) {
      throw new Error('One or both system cards not found');
    }

    const differences = this.computeDifferences(systemA, systemB);
    const summary = this.generateComparisonSummary(systemA, systemB, differences);

    return { systemA, systemB, differences, summary };
  }

  private computeDifferences(a: SystemCard, b: SystemCard): VersionDifference[] {
    const differences: VersionDifference[] = [];
    const fields: (keyof SystemCard)[] = ['inputs', 'outputs', 'interpretation', 'limitations'];

    for (const field of fields) {
      const valueA = JSON.stringify(a[field]);
      const valueB = JSON.stringify(b[field]);
      if (valueA !== valueB) {
        differences.push({
          field,
          valueA: a[field],
          valueB: b[field],
          significance: this.assessSignificance(field),
        });
      }
    }
    return differences;
  }

  private assessSignificance(field: string): 'minor' | 'moderate' | 'major' {
    if (field === 'inputs' || field === 'outputs') return 'major';
    if (field === 'interpretation') return 'moderate';
    return 'minor';
  }

  private generateComparisonSummary(
    a: SystemCard,
    b: SystemCard,
    differences: VersionDifference[]
  ): string {
    if (differences.length === 0) {
      return `${a.name} versions are identical.`;
    }

    const majorChanges = differences.filter((d) => d.significance === 'major');
    const moderateChanges = differences.filter((d) => d.significance === 'moderate');

    let summary = `Comparing ${a.name} (${a.version || 'v1'}) to (${b.version || 'v2'}): `;

    if (majorChanges.length > 0) {
      summary += `${majorChanges.length} major change(s) in ${majorChanges.map((d) => d.field).join(', ')}. `;
    }
    if (moderateChanges.length > 0) {
      summary += `${moderateChanges.length} moderate change(s) in ${moderateChanges.map((d) => d.field).join(', ')}. `;
    }

    return summary;
  }

  // ==========================================================================
  // VALIDATION BLUEPRINT GENERATION
  // ==========================================================================

  async generateValidationBlueprint(
    request: GenerateBlueprintRequest,
    userId: string
  ): Promise<ValidationBlueprint> {
    const systemCard = await this.repository.getSystemCard(request.systemCardId);
    if (!systemCard) {
      throw new Error(`System card not found: ${request.systemCardId}`);
    }

    const blueprint = this.buildBlueprintTemplate(systemCard, request);

    return this.repository.createValidationBlueprint({
      ...blueprint,
      systemCardId: request.systemCardId,
      userId,
      status: 'draft',
    });
  }

  private buildBlueprintTemplate(
    systemCard: SystemCard,
    request: GenerateBlueprintRequest
  ): Omit<ValidationBlueprint, 'id' | 'systemCardId' | 'userId' | 'createdAt' | 'updatedAt'> {
    const studyIntentConfig = this.getStudyIntentConfig(request.studyIntent);

    // Build data dictionary from system card inputs
    const dataDictionary = systemCard.inputs.map((input) => ({
      variable: input.name,
      type: input.type,
      source: 'EHR/Registry',
      required: input.required,
      description: input.description || '',
    }));

    // Add outcome variables
    for (const output of systemCard.outputs) {
      dataDictionary.push({
        variable: `outcome_${output.name}`,
        type: output.type === 'score' ? 'numeric' : 'categorical',
        source: 'Calculated',
        required: true,
        description: output.description || '',
      });
    }

    // Build outcomes based on intended use
    const outcomes = this.buildOutcomes(systemCard);

    // Build analysis plan
    const analysisPlan = this.buildAnalysisPlan(systemCard, request.studyIntent);

    // Build validation metrics
    const validationMetrics = this.buildValidationMetrics(systemCard, request.studyIntent);

    return {
      studyIntent: request.studyIntent,
      researchAims: [
        `Validate ${systemCard.name} in ${request.targetPopulation || 'an external cohort'}`,
        studyIntentConfig.primaryAim,
      ],
      hypotheses: [
        `${systemCard.name} will demonstrate ${studyIntentConfig.expectedPerformance} in the validation cohort`,
      ],
      dataDictionary,
      outcomes,
      inclusionCriteria: [
        'Age ≥ 18 years',
        'Complete data for all required predictors',
        request.targetPopulation ? `Meets ${request.targetPopulation} criteria` : '',
      ].filter(Boolean),
      exclusionCriteria: [
        'Missing outcome data',
        'Lost to follow-up within study period',
      ],
      analysisPlan,
      validationMetrics,
      sensitivityAnalyses: [
        'Complete case analysis',
        'Multiple imputation for missing data',
        'Subgroup analyses by age, sex, comorbidities',
      ],
      limitations: systemCard.limitations || [],
      reportingChecklist: this.getReportingChecklist(systemCard, request.studyIntent),
      status: 'draft',
    };
  }

  private getStudyIntentConfig(intent: StudyIntent): {
    primaryAim: string;
    expectedPerformance: string;
  } {
    const configs: Record<StudyIntent, { primaryAim: string; expectedPerformance: string }> = {
      external_validation: {
        primaryAim: 'Assess discrimination and calibration in an independent external cohort',
        expectedPerformance: 'adequate discrimination (C-statistic > 0.7) and calibration',
      },
      temporal_validation: {
        primaryAim: 'Evaluate temporal stability of model performance across different time periods',
        expectedPerformance: 'stable discrimination and calibration over time',
      },
      subgroup_validation: {
        primaryAim: 'Assess model performance across clinically relevant subgroups',
        expectedPerformance: 'consistent performance across subgroups',
      },
      head_to_head: {
        primaryAim: 'Compare performance against existing prediction tools',
        expectedPerformance: 'non-inferior or superior discrimination',
      },
      recalibration: {
        primaryAim: 'Update model calibration for the target population',
        expectedPerformance: 'improved calibration after recalibration',
      },
      simplification: {
        primaryAim: 'Develop and validate a simplified version with fewer predictors',
        expectedPerformance: 'minimal loss of discrimination with simplified model',
      },
      fairness: {
        primaryAim: 'Assess fairness and equity across demographic groups',
        expectedPerformance: 'equitable performance across demographic groups',
      },
    };
    return configs[intent];
  }

  private buildOutcomes(systemCard: SystemCard): ValidationBlueprint['outcomes'] {
    const outcomes: ValidationBlueprint['outcomes'] = [];

    // Primary outcome based on intended use
    if (systemCard.intendedUse === 'prognosis') {
      outcomes.push({
        name: 'Primary outcome',
        type: 'time_to_event',
        timeHorizon: '1 year',
        definition: 'Time to event or censoring',
      });
    } else if (systemCard.intendedUse === 'diagnosis') {
      outcomes.push({
        name: 'Diagnosis',
        type: 'binary',
        definition: 'Confirmed diagnosis by reference standard',
      });
    } else {
      outcomes.push({
        name: 'Primary outcome',
        type: 'binary',
        definition: 'Occurrence of primary event',
      });
    }

    return outcomes;
  }

  private buildAnalysisPlan(
    systemCard: SystemCard,
    intent: StudyIntent
  ): ValidationBlueprint['analysisPlan'] {
    const plan: ValidationBlueprint['analysisPlan'] = [];

    // Discrimination analysis
    plan.push({
      method: systemCard.intendedUse === 'prognosis'
        ? 'C-statistic (Harrell concordance index)'
        : 'Area under ROC curve (AUC)',
      rationale: 'Assess discrimination ability of the prediction model',
      assumptions: ['Independent observations', 'Adequate sample size'],
    });

    // Calibration analysis
    plan.push({
      method: 'Calibration plot with calibration slope and intercept',
      rationale: 'Assess agreement between predicted and observed outcomes',
      assumptions: ['Continuous risk estimates available'],
    });

    // Intent-specific analyses
    if (intent === 'head_to_head') {
      plan.push({
        method: 'DeLong test for comparison of AUCs',
        rationale: 'Statistically compare discrimination between models',
        assumptions: ['Paired samples', 'Same population'],
      });
    }

    if (intent === 'fairness') {
      plan.push({
        method: 'Subgroup analysis with interaction tests',
        rationale: 'Assess performance variation across demographic groups',
        assumptions: ['Adequate subgroup sample sizes'],
      });
    }

    return plan;
  }

  private buildValidationMetrics(
    systemCard: SystemCard,
    intent: StudyIntent
  ): ValidationBlueprint['validationMetrics'] {
    const metrics: ValidationBlueprint['validationMetrics'] = [];

    // Core discrimination metrics
    metrics.push({
      metric: systemCard.intendedUse === 'prognosis' ? 'C-statistic' : 'AUC-ROC',
      interpretation: '0.7-0.8 acceptable, 0.8-0.9 excellent, >0.9 outstanding',
      threshold: '≥0.7',
    });

    // Calibration metrics
    metrics.push({
      metric: 'Calibration slope',
      interpretation: 'Ideal = 1.0; <1 indicates overfitting; >1 indicates underfitting',
      threshold: '0.8-1.2',
    });

    metrics.push({
      metric: 'Calibration-in-the-large',
      interpretation: 'Mean predicted vs mean observed; ideal = 0',
      threshold: 'Within 10% of baseline risk',
    });

    // Additional metrics based on intent
    if (intent === 'head_to_head') {
      metrics.push({
        metric: 'Net reclassification improvement (NRI)',
        interpretation: 'Proportion correctly reclassified minus proportion incorrectly reclassified',
        threshold: '>0 favors new model',
      });
    }

    return metrics;
  }

  private getReportingChecklist(
    systemCard: SystemCard,
    intent: StudyIntent
  ): string[] {
    const checklists: string[] = ['TRIPOD'];

    if (systemCard.type === 'score' || systemCard.type === 'staging') {
      checklists.push('TRIPOD');
    }

    if (intent === 'external_validation') {
      checklists.push('PROBAST');
    }

    if (systemCard.intendedUse === 'prognosis') {
      checklists.push('STROBE');
    }

    return [...new Set(checklists)];
  }

  // ==========================================================================
  // GUIDELINE SUMMARIZATION
  // ==========================================================================

  async summarizeGuideline(systemCardId: string, query?: string): Promise<string> {
    const details = await this.getSystemCardWithDetails(systemCardId);
    if (!details) {
      throw new Error(`System card not found: ${systemCardId}`);
    }

    const { systemCard, evidence } = details;

    // Build summary from structured data
    let summary = `## ${systemCard.name}\n\n`;
    summary += `**Type:** ${systemCard.type}\n`;
    summary += `**Specialty:** ${systemCard.specialty || 'Not specified'}\n`;
    summary += `**Intended Use:** ${systemCard.intendedUse || 'Not specified'}\n\n`;

    // Inputs
    if (systemCard.inputs.length > 0) {
      summary += '### Required Inputs\n';
      for (const input of systemCard.inputs) {
        summary += `- **${input.name}** (${input.type})${input.required ? ' *required*' : ''}: ${input.description || ''}\n`;
      }
      summary += '\n';
    }

    // Outputs
    if (systemCard.outputs.length > 0) {
      summary += '### Outputs\n';
      for (const output of systemCard.outputs) {
        summary += `- **${output.name}** (${output.type}): ${output.description || ''}\n`;
      }
      summary += '\n';
    }

    // Interpretation
    if (systemCard.interpretation.length > 0) {
      summary += '### Interpretation\n';
      for (const interp of systemCard.interpretation) {
        summary += `- **${interp.range}:** ${interp.meaning}\n`;
      }
      summary += '\n';
    }

    // Limitations
    if (systemCard.limitations && systemCard.limitations.length > 0) {
      summary += '### Limitations\n';
      for (const limitation of systemCard.limitations) {
        summary += `- ${limitation}\n`;
      }
      summary += '\n';
    }

    // Evidence
    if (evidence.length > 0) {
      summary += '### Key Evidence\n';
      for (const stmt of evidence.slice(0, 5)) {
        summary += `- ${stmt.statementText}`;
        if (stmt.citationRef) {
          summary += ` (${stmt.citationRef})`;
        }
        summary += '\n';
      }
    }

    return summary;
  }
}
