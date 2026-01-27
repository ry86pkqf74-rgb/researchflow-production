/**
 * Guidelines Repository
 *
 * Data access layer for the Guidelines Engine.
 * Provides CRUD operations for system cards, rule specs, evidence, and blueprints.
 */

import { Pool } from 'pg';
import {
  SourceRegistry,
  GuidelineDocument,
  SystemCard,
  RuleSpec,
  EvidenceStatement,
  VersionGraphEntry,
  ValidationBlueprint,
  CalculatorResult,
  SearchSystemCardsRequest,
  CreateSystemCardInput,
  UpdateSystemCardInput,
  CreateRuleSpecInput,
  CreateEvidenceStatementInput,
  CreateValidationBlueprintInput,
  UpdateValidationBlueprintInput,
} from '../types/guidelines';

export class GuidelinesRepository {
  constructor(private pool: Pool) {}

  // ==========================================================================
  // SOURCE REGISTRY
  // ==========================================================================

  async createSourceRegistry(
    source: Omit<SourceRegistry, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<SourceRegistry> {
    const result = await this.pool.query(
      `INSERT INTO source_registry (
        publisher_name, url_pattern, access_method, license_type, update_cadence,
        allow_store_full_text, allow_store_tables, allow_store_embeddings,
        allow_show_excerpts, excerpt_max_length, require_deep_link
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        source.publisherName,
        source.urlPattern,
        source.accessMethod,
        source.licenseType,
        source.updateCadence,
        source.allowStoreFullText,
        source.allowStoreTables,
        source.allowStoreEmbeddings,
        source.allowShowExcerpts,
        source.excerptMaxLength,
        source.requireDeepLink,
      ]
    );
    return this.mapSourceRegistry(result.rows[0]);
  }

  async getSourceRegistry(id: string): Promise<SourceRegistry | null> {
    const result = await this.pool.query('SELECT * FROM source_registry WHERE id = $1', [id]);
    return result.rows[0] ? this.mapSourceRegistry(result.rows[0]) : null;
  }

  async listSourceRegistries(): Promise<SourceRegistry[]> {
    const result = await this.pool.query('SELECT * FROM source_registry ORDER BY publisher_name');
    return result.rows.map((row) => this.mapSourceRegistry(row));
  }

  // ==========================================================================
  // GUIDELINE DOCUMENTS
  // ==========================================================================

  async createGuidelineDocument(
    doc: Omit<GuidelineDocument, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<GuidelineDocument> {
    const result = await this.pool.query(
      `INSERT INTO guideline_documents (
        title, publisher, publication_date, version_label, url,
        jurisdiction, source_registry_id, raw_artifact_path, change_summary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        doc.title,
        doc.publisher,
        doc.publicationDate,
        doc.versionLabel,
        doc.url,
        doc.jurisdiction,
        doc.sourceRegistryId,
        doc.rawArtifactPath,
        doc.changeSummary,
      ]
    );
    return this.mapGuidelineDocument(result.rows[0]);
  }

  async getGuidelineDocument(id: string): Promise<GuidelineDocument | null> {
    const result = await this.pool.query('SELECT * FROM guideline_documents WHERE id = $1', [id]);
    return result.rows[0] ? this.mapGuidelineDocument(result.rows[0]) : null;
  }

  // ==========================================================================
  // SYSTEM CARDS
  // ==========================================================================

  async createSystemCard(card: CreateSystemCardInput): Promise<SystemCard> {
    const result = await this.pool.query(
      `INSERT INTO system_cards (
        name, type, specialty, condition_concepts, intended_use, population, care_setting,
        inputs, outputs, interpretation, limitations, evidence_summary,
        guideline_document_id, version, effective_date, superseded_by, status,
        extraction_confidence, verified, verified_by, verified_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *`,
      [
        card.name,
        card.type,
        card.specialty,
        JSON.stringify(card.conditionConcepts),
        card.intendedUse,
        card.population,
        card.careSetting,
        JSON.stringify(card.inputs),
        JSON.stringify(card.outputs),
        JSON.stringify(card.interpretation),
        card.limitations,
        card.evidenceSummary ? JSON.stringify(card.evidenceSummary) : null,
        card.guidelineDocumentId,
        card.version,
        card.effectiveDate,
        card.supersededBy,
        card.status,
        card.extractionConfidence,
        card.verified,
        card.verifiedBy,
        card.verifiedAt,
      ]
    );
    return this.mapSystemCard(result.rows[0]);
  }

  async getSystemCard(id: string): Promise<SystemCard | null> {
    const result = await this.pool.query('SELECT * FROM system_cards WHERE id = $1', [id]);
    return result.rows[0] ? this.mapSystemCard(result.rows[0]) : null;
  }

  async getSystemCardByName(name: string): Promise<SystemCard | null> {
    const result = await this.pool.query(
      `SELECT * FROM system_cards
       WHERE LOWER(name) = LOWER($1) AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`,
      [name]
    );
    return result.rows[0] ? this.mapSystemCard(result.rows[0]) : null;
  }

  async searchSystemCards(
    params: SearchSystemCardsRequest
  ): Promise<{ systems: SystemCard[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (params.query) {
      conditions.push(`(name ILIKE $${paramIndex} OR specialty ILIKE $${paramIndex})`);
      values.push(`%${params.query}%`);
      paramIndex++;
    }
    if (params.type) {
      conditions.push(`type = $${paramIndex}`);
      values.push(params.type);
      paramIndex++;
    }
    if (params.specialty) {
      conditions.push(`specialty ILIKE $${paramIndex}`);
      values.push(`%${params.specialty}%`);
      paramIndex++;
    }
    if (params.intendedUse) {
      conditions.push(`intended_use = $${paramIndex}`);
      values.push(params.intendedUse);
      paramIndex++;
    }
    if (params.status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(params.status);
      paramIndex++;
    }
    if (params.verified !== undefined) {
      conditions.push(`verified = $${paramIndex}`);
      values.push(params.verified);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = params.limit || 50;
    const offset = params.offset || 0;

    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM system_cards ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query(
      `SELECT * FROM system_cards ${whereClause}
       ORDER BY name
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    );

    return {
      systems: result.rows.map((row) => this.mapSystemCard(row)),
      total,
    };
  }

  async updateSystemCard(id: string, updates: UpdateSystemCardInput): Promise<SystemCard | null> {
    const fieldMap: Record<string, string> = {
      name: 'name',
      type: 'type',
      specialty: 'specialty',
      conditionConcepts: 'condition_concepts',
      intendedUse: 'intended_use',
      population: 'population',
      careSetting: 'care_setting',
      inputs: 'inputs',
      outputs: 'outputs',
      interpretation: 'interpretation',
      limitations: 'limitations',
      evidenceSummary: 'evidence_summary',
      status: 'status',
      verified: 'verified',
      verifiedBy: 'verified_by',
      verifiedAt: 'verified_at',
    };

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (updates[key as keyof UpdateSystemCardInput] !== undefined) {
        fields.push(`${dbField} = $${paramIndex}`);
        let value = updates[key as keyof UpdateSystemCardInput];
        if (
          ['conditionConcepts', 'inputs', 'outputs', 'interpretation', 'evidenceSummary'].includes(
            key
          )
        ) {
          value = JSON.stringify(value);
        }
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) return this.getSystemCard(id);

    fields.push('updated_at = NOW()');
    values.push(id);

    const result = await this.pool.query(
      `UPDATE system_cards SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] ? this.mapSystemCard(result.rows[0]) : null;
  }

  // ==========================================================================
  // RULE SPECS
  // ==========================================================================

  async createRuleSpec(spec: CreateRuleSpecInput): Promise<RuleSpec> {
    const result = await this.pool.query(
      `INSERT INTO rule_specs (system_card_id, name, description, rule_type, rule_definition, test_cases, validated)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        spec.systemCardId,
        spec.name,
        spec.description,
        spec.ruleType,
        JSON.stringify(spec.ruleDefinition),
        JSON.stringify(spec.testCases),
        spec.validated,
      ]
    );
    return this.mapRuleSpec(result.rows[0]);
  }

  async getRuleSpec(id: string): Promise<RuleSpec | null> {
    const result = await this.pool.query('SELECT * FROM rule_specs WHERE id = $1', [id]);
    return result.rows[0] ? this.mapRuleSpec(result.rows[0]) : null;
  }

  async getRuleSpecsForSystemCard(systemCardId: string): Promise<RuleSpec[]> {
    const result = await this.pool.query(
      'SELECT * FROM rule_specs WHERE system_card_id = $1 ORDER BY name',
      [systemCardId]
    );
    return result.rows.map((row) => this.mapRuleSpec(row));
  }

  // ==========================================================================
  // EVIDENCE STATEMENTS
  // ==========================================================================

  async createEvidenceStatement(stmt: CreateEvidenceStatementInput): Promise<EvidenceStatement> {
    const result = await this.pool.query(
      `INSERT INTO evidence_statements (
        system_card_id, statement_text, strength, quality, evidence_type,
        citation_ref, source_url, source_page, source_section
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        stmt.systemCardId,
        stmt.statementText,
        stmt.strength,
        stmt.quality,
        stmt.evidenceType,
        stmt.citationRef,
        stmt.sourceUrl,
        stmt.sourcePage,
        stmt.sourceSection,
      ]
    );
    return this.mapEvidenceStatement(result.rows[0]);
  }

  async getEvidenceForSystemCard(systemCardId: string): Promise<EvidenceStatement[]> {
    const result = await this.pool.query(
      'SELECT * FROM evidence_statements WHERE system_card_id = $1 ORDER BY created_at',
      [systemCardId]
    );
    return result.rows.map((row) => this.mapEvidenceStatement(row));
  }

  // ==========================================================================
  // VERSION GRAPH
  // ==========================================================================

  async createVersionGraphEntry(
    entry: Omit<VersionGraphEntry, 'id' | 'createdAt'>
  ): Promise<VersionGraphEntry> {
    const result = await this.pool.query(
      `INSERT INTO version_graph (system_card_id, previous_version_id, change_type, change_summary, diff_data)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        entry.systemCardId,
        entry.previousVersionId,
        entry.changeType,
        entry.changeSummary,
        entry.diffData ? JSON.stringify(entry.diffData) : null,
      ]
    );
    return this.mapVersionGraphEntry(result.rows[0]);
  }

  async getVersionHistory(systemCardId: string): Promise<VersionGraphEntry[]> {
    const result = await this.pool.query(
      'SELECT * FROM version_graph WHERE system_card_id = $1 ORDER BY created_at DESC',
      [systemCardId]
    );
    return result.rows.map((row) => this.mapVersionGraphEntry(row));
  }

  // ==========================================================================
  // VALIDATION BLUEPRINTS
  // ==========================================================================

  async createValidationBlueprint(bp: CreateValidationBlueprintInput): Promise<ValidationBlueprint> {
    const result = await this.pool.query(
      `INSERT INTO validation_blueprints (
        system_card_id, user_id, study_intent, research_aims, hypotheses,
        data_dictionary, outcomes, inclusion_criteria, exclusion_criteria,
        analysis_plan, validation_metrics, sensitivity_analyses,
        limitations, reporting_checklist, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [
        bp.systemCardId,
        bp.userId,
        bp.studyIntent,
        JSON.stringify(bp.researchAims),
        JSON.stringify(bp.hypotheses),
        JSON.stringify(bp.dataDictionary),
        JSON.stringify(bp.outcomes),
        JSON.stringify(bp.inclusionCriteria),
        JSON.stringify(bp.exclusionCriteria),
        JSON.stringify(bp.analysisPlan),
        JSON.stringify(bp.validationMetrics),
        JSON.stringify(bp.sensitivityAnalyses),
        bp.limitations,
        bp.reportingChecklist,
        bp.status,
      ]
    );
    return this.mapValidationBlueprint(result.rows[0]);
  }

  async getValidationBlueprint(id: string): Promise<ValidationBlueprint | null> {
    const result = await this.pool.query('SELECT * FROM validation_blueprints WHERE id = $1', [id]);
    return result.rows[0] ? this.mapValidationBlueprint(result.rows[0]) : null;
  }

  async listBlueprintsForUser(userId: string): Promise<ValidationBlueprint[]> {
    const result = await this.pool.query(
      'SELECT * FROM validation_blueprints WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows.map((row) => this.mapValidationBlueprint(row));
  }

  async listBlueprintsForSystemCard(systemCardId: string): Promise<ValidationBlueprint[]> {
    const result = await this.pool.query(
      'SELECT * FROM validation_blueprints WHERE system_card_id = $1 ORDER BY created_at DESC',
      [systemCardId]
    );
    return result.rows.map((row) => this.mapValidationBlueprint(row));
  }

  async updateValidationBlueprint(
    id: string,
    updates: UpdateValidationBlueprintInput
  ): Promise<ValidationBlueprint | null> {
    const result = await this.pool.query(
      `UPDATE validation_blueprints SET
        research_aims = COALESCE($1, research_aims),
        hypotheses = COALESCE($2, hypotheses),
        data_dictionary = COALESCE($3, data_dictionary),
        outcomes = COALESCE($4, outcomes),
        inclusion_criteria = COALESCE($5, inclusion_criteria),
        exclusion_criteria = COALESCE($6, exclusion_criteria),
        analysis_plan = COALESCE($7, analysis_plan),
        validation_metrics = COALESCE($8, validation_metrics),
        sensitivity_analyses = COALESCE($9, sensitivity_analyses),
        limitations = COALESCE($10, limitations),
        reporting_checklist = COALESCE($11, reporting_checklist),
        status = COALESCE($12, status),
        updated_at = NOW()
      WHERE id = $13 RETURNING *`,
      [
        updates.researchAims ? JSON.stringify(updates.researchAims) : null,
        updates.hypotheses ? JSON.stringify(updates.hypotheses) : null,
        updates.dataDictionary ? JSON.stringify(updates.dataDictionary) : null,
        updates.outcomes ? JSON.stringify(updates.outcomes) : null,
        updates.inclusionCriteria ? JSON.stringify(updates.inclusionCriteria) : null,
        updates.exclusionCriteria ? JSON.stringify(updates.exclusionCriteria) : null,
        updates.analysisPlan ? JSON.stringify(updates.analysisPlan) : null,
        updates.validationMetrics ? JSON.stringify(updates.validationMetrics) : null,
        updates.sensitivityAnalyses ? JSON.stringify(updates.sensitivityAnalyses) : null,
        updates.limitations,
        updates.reportingChecklist,
        updates.status,
        id,
      ]
    );
    return result.rows[0] ? this.mapValidationBlueprint(result.rows[0]) : null;
  }

  // ==========================================================================
  // CALCULATOR RESULTS
  // ==========================================================================

  async saveCalculatorResult(
    result: Omit<CalculatorResult, 'id' | 'createdAt'>
  ): Promise<CalculatorResult> {
    const dbResult = await this.pool.query(
      `INSERT INTO calculator_results (system_card_id, rule_spec_id, user_id, inputs, outputs, interpretation, context)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        result.systemCardId,
        result.ruleSpecId,
        result.userId,
        JSON.stringify(result.inputs),
        JSON.stringify(result.outputs),
        result.interpretation,
        result.context,
      ]
    );
    return this.mapCalculatorResult(dbResult.rows[0]);
  }

  async getCalculatorHistory(
    systemCardId: string,
    userId?: string,
    limit = 100
  ): Promise<CalculatorResult[]> {
    let query = 'SELECT * FROM calculator_results WHERE system_card_id = $1';
    const params: unknown[] = [systemCardId];

    if (userId) {
      query += ' AND user_id = $2';
      params.push(userId);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await this.pool.query(query, params);
    return result.rows.map((row) => this.mapCalculatorResult(row));
  }

  // ==========================================================================
  // MAPPERS
  // ==========================================================================

  private mapSourceRegistry(row: Record<string, unknown>): SourceRegistry {
    return {
      id: row.id as string,
      publisherName: row.publisher_name as string,
      urlPattern: row.url_pattern as string | undefined,
      accessMethod: row.access_method as SourceRegistry['accessMethod'],
      licenseType: row.license_type as SourceRegistry['licenseType'],
      updateCadence: row.update_cadence as SourceRegistry['updateCadence'] | undefined,
      allowStoreFullText: row.allow_store_full_text as boolean,
      allowStoreTables: row.allow_store_tables as boolean,
      allowStoreEmbeddings: row.allow_store_embeddings as boolean,
      allowShowExcerpts: row.allow_show_excerpts as boolean,
      excerptMaxLength: row.excerpt_max_length as number,
      requireDeepLink: row.require_deep_link as boolean,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }

  private mapGuidelineDocument(row: Record<string, unknown>): GuidelineDocument {
    return {
      id: row.id as string,
      title: row.title as string,
      publisher: row.publisher as string | undefined,
      publicationDate: row.publication_date as Date | undefined,
      versionLabel: row.version_label as string | undefined,
      url: row.url as string | undefined,
      jurisdiction: row.jurisdiction as string | undefined,
      sourceRegistryId: row.source_registry_id as string | undefined,
      rawArtifactPath: row.raw_artifact_path as string | undefined,
      changeSummary: row.change_summary as string | undefined,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }

  private mapSystemCard(row: Record<string, unknown>): SystemCard {
    return {
      id: row.id as string,
      name: row.name as string,
      type: row.type as SystemCard['type'],
      specialty: row.specialty as string | undefined,
      conditionConcepts: (row.condition_concepts as SystemCard['conditionConcepts']) || [],
      intendedUse: row.intended_use as SystemCard['intendedUse'] | undefined,
      population: row.population as string | undefined,
      careSetting: row.care_setting as string | undefined,
      inputs: (row.inputs as SystemCard['inputs']) || [],
      outputs: (row.outputs as SystemCard['outputs']) || [],
      interpretation: (row.interpretation as SystemCard['interpretation']) || [],
      limitations: row.limitations as string[] | undefined,
      evidenceSummary: row.evidence_summary as SystemCard['evidenceSummary'] | undefined,
      guidelineDocumentId: row.guideline_document_id as string | undefined,
      version: row.version as string | undefined,
      effectiveDate: row.effective_date as Date | undefined,
      supersededBy: row.superseded_by as string | undefined,
      status: row.status as SystemCard['status'],
      extractionConfidence: row.extraction_confidence
        ? parseFloat(row.extraction_confidence as string)
        : undefined,
      verified: row.verified as boolean,
      verifiedBy: row.verified_by as string | undefined,
      verifiedAt: row.verified_at as Date | undefined,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }

  private mapRuleSpec(row: Record<string, unknown>): RuleSpec {
    return {
      id: row.id as string,
      systemCardId: row.system_card_id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      ruleType: row.rule_type as RuleSpec['ruleType'],
      ruleDefinition: row.rule_definition as RuleSpec['ruleDefinition'],
      testCases: (row.test_cases as RuleSpec['testCases']) || [],
      validated: row.validated as boolean,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }

  private mapEvidenceStatement(row: Record<string, unknown>): EvidenceStatement {
    return {
      id: row.id as string,
      systemCardId: row.system_card_id as string,
      statementText: row.statement_text as string,
      strength: row.strength as EvidenceStatement['strength'] | undefined,
      quality: row.quality as EvidenceStatement['quality'] | undefined,
      evidenceType: row.evidence_type as EvidenceStatement['evidenceType'] | undefined,
      citationRef: row.citation_ref as string | undefined,
      sourceUrl: row.source_url as string | undefined,
      sourcePage: row.source_page as string | undefined,
      sourceSection: row.source_section as string | undefined,
      createdAt: row.created_at as Date,
    };
  }

  private mapVersionGraphEntry(row: Record<string, unknown>): VersionGraphEntry {
    return {
      id: row.id as string,
      systemCardId: row.system_card_id as string,
      previousVersionId: row.previous_version_id as string | undefined,
      changeType: row.change_type as VersionGraphEntry['changeType'] | undefined,
      changeSummary: row.change_summary as string | undefined,
      diffData: row.diff_data as Record<string, unknown> | undefined,
      createdAt: row.created_at as Date,
    };
  }

  private mapValidationBlueprint(row: Record<string, unknown>): ValidationBlueprint {
    return {
      id: row.id as string,
      systemCardId: row.system_card_id as string,
      userId: row.user_id as string,
      studyIntent: row.study_intent as ValidationBlueprint['studyIntent'],
      researchAims: (row.research_aims as string[]) || [],
      hypotheses: (row.hypotheses as string[]) || [],
      dataDictionary: (row.data_dictionary as ValidationBlueprint['dataDictionary']) || [],
      outcomes: (row.outcomes as ValidationBlueprint['outcomes']) || [],
      inclusionCriteria: (row.inclusion_criteria as string[]) || [],
      exclusionCriteria: (row.exclusion_criteria as string[]) || [],
      analysisPlan: (row.analysis_plan as ValidationBlueprint['analysisPlan']) || [],
      validationMetrics: (row.validation_metrics as ValidationBlueprint['validationMetrics']) || [],
      sensitivityAnalyses: (row.sensitivity_analyses as string[]) || [],
      limitations: row.limitations as string[] | undefined,
      reportingChecklist: (row.reporting_checklist as string[]) || [],
      status: row.status as ValidationBlueprint['status'],
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }

  private mapCalculatorResult(row: Record<string, unknown>): CalculatorResult {
    return {
      id: row.id as string,
      systemCardId: row.system_card_id as string,
      ruleSpecId: row.rule_spec_id as string | undefined,
      userId: row.user_id as string | undefined,
      inputs: row.inputs as Record<string, unknown>,
      outputs: row.outputs as Record<string, unknown>,
      interpretation: row.interpretation as string | undefined,
      context: row.context as CalculatorResult['context'],
      createdAt: row.created_at as Date,
    };
  }
}
