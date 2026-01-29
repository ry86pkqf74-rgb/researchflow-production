/**
 * Guidelines Engine API Client
 *
 * TypeScript client for the Guidelines Engine REST API.
 * Provides typed methods for searching, calculating, comparing, and planning
 * clinical scoring systems and validation studies.
 *
 * @example
 * ```typescript
 * const client = new GuidelinesApiClient('http://localhost:3001');
 * const results = await client.searchSystemCards({ specialty: 'Cardiology' });
 * const score = await client.calculateScore('cha2ds2-vasc-id', {
 *   age: 72, sex: 'female', chf_history: true, hypertension: true,
 *   stroke_tia_history: false, vascular_disease: false, diabetes: true
 * });
 * ```
 */

// =============================================================================
// Types (mirrored from backend for frontend use)
// =============================================================================

export type SystemCardType = 'score' | 'staging' | 'grading' | 'guideline' | 'classification' | 'criteria' | 'reporting_standard';
export type IntendedUse = 'diagnosis' | 'prognosis' | 'treatment_selection' | 'severity' | 'complications' | 'quality';
export type SystemCardStatus = 'active' | 'superseded' | 'retired' | 'draft';
export type StudyIntent = 'external_validation' | 'temporal_validation' | 'subgroup_validation' | 'head_to_head' | 'recalibration' | 'simplification' | 'fairness';
export type BlueprintStatus = 'draft' | 'finalized' | 'exported';
export type RuleType = 'threshold' | 'lookup_table' | 'formula' | 'decision_tree';
export type CalculationContext = 'research' | 'education' | 'demo';

export interface ConditionConcept {
  system: 'MeSH' | 'SNOMED' | 'ICD10' | 'ICD11';
  code: string;
  term: string;
}

export interface InputVariable {
  name: string;
  type: 'numeric' | 'categorical' | 'boolean' | 'date' | 'text';
  unit?: string;
  required: boolean;
  description?: string;
  validValues?: string[] | { min?: number; max?: number };
}

export interface OutputDefinition {
  name: string;
  type: 'score' | 'stage' | 'grade' | 'class' | 'category' | 'risk';
  range?: string;
  labels?: string[];
  description?: string;
}

export interface InterpretationEntry {
  range: string;
  meaning: string;
  clinicalAction?: string;
}

export interface EvidenceSummary {
  derivationStudy?: string;
  derivationPopulation?: string;
  derivationSize?: number;
  validationStudies?: number;
  lastValidated?: Date;
  knownLimitations?: string[];
}

export interface SystemCard {
  id: string;
  name: string;
  type: SystemCardType;
  specialty?: string;
  conditionConcepts: ConditionConcept[];
  intendedUse?: IntendedUse;
  population?: string;
  careSetting?: string;
  inputs: InputVariable[];
  outputs: OutputDefinition[];
  interpretation: InterpretationEntry[];
  limitations?: string[];
  evidenceSummary?: EvidenceSummary;
  guidelineDocumentId?: string;
  version?: string;
  effectiveDate?: Date;
  supersededBy?: string;
  status: SystemCardStatus;
  extractionConfidence?: number;
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RuleTestCase {
  inputs: Record<string, unknown>;
  expectedOutput: Record<string, unknown>;
  description?: string;
}

export interface RuleSpec {
  id: string;
  systemCardId: string;
  name: string;
  description?: string;
  ruleType: RuleType;
  ruleDefinition: Record<string, unknown>;
  testCases: RuleTestCase[];
  validated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EvidenceStatement {
  id: string;
  systemCardId: string;
  statementText: string;
  strength?: 'strong' | 'moderate' | 'weak' | 'expert_consensus';
  quality?: 'high' | 'moderate' | 'low' | 'very_low';
  evidenceType?: 'rct' | 'cohort' | 'case_control' | 'case_series' | 'expert_opinion';
  citationRef?: string;
  sourceUrl?: string;
  sourcePage?: string;
  sourceSection?: string;
  createdAt: Date;
}

export interface VersionGraphEntry {
  id: string;
  systemCardId: string;
  previousVersionId?: string;
  changeType?: 'new_edition' | 'correction' | 'update' | 'major_revision';
  changeSummary?: string;
  diffData?: Record<string, unknown>;
  createdAt: Date;
}

export interface DataDictionaryEntry {
  variable: string;
  type: 'numeric' | 'categorical' | 'boolean' | 'date' | 'text';
  source: string;
  required: boolean;
  description?: string;
  mapping?: string;
}

export interface OutcomeDefinition {
  name: string;
  type: 'binary' | 'continuous' | 'time_to_event' | 'ordinal';
  timeHorizon?: string;
  definition?: string;
}

export interface AnalysisMethod {
  method: string;
  rationale: string;
  assumptions?: string[];
  alternatives?: string[];
}

export interface ValidationMetric {
  metric: string;
  interpretation: string;
  threshold?: string;
}

export interface ValidationBlueprint {
  id: string;
  systemCardId: string;
  userId: string;
  studyIntent: StudyIntent;
  researchAims: string[];
  hypotheses: string[];
  dataDictionary: DataDictionaryEntry[];
  outcomes: OutcomeDefinition[];
  inclusionCriteria: string[];
  exclusionCriteria: string[];
  analysisPlan: AnalysisMethod[];
  validationMetrics: ValidationMetric[];
  sensitivityAnalyses: string[];
  limitations?: string[];
  reportingChecklist: string[];
  status: BlueprintStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CalculatorResult {
  id: string;
  systemCardId: string;
  ruleSpecId?: string;
  userId?: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  interpretation?: string;
  context: CalculationContext;
  createdAt: Date;
}

// =============================================================================
// Request/Response Types
// =============================================================================

export interface SearchSystemCardsParams {
  query?: string;
  type?: SystemCardType;
  specialty?: string;
  condition?: string;
  intendedUse?: IntendedUse;
  status?: SystemCardStatus;
  verified?: boolean;
  limit?: number;
  offset?: number;
}

export interface SearchSystemCardsResponse {
  systems: SystemCard[];
  total: number;
  limit: number;
  offset: number;
}

export interface SystemCardWithDetails {
  systemCard: SystemCard;
  ruleSpecs: RuleSpec[];
  evidence: EvidenceStatement[];
  versions: VersionGraphEntry[];
}

export interface CalculateScoreParams {
  systemCardId: string;
  inputs: Record<string, unknown>;
  context?: CalculationContext;
}

export interface CalculateScoreResponse {
  result: CalculatorResult;
  systemCard: SystemCard;
  ruleSpec?: RuleSpec;
}

export interface CompareVersionsParams {
  systemCardIdA: string;
  systemCardIdB: string;
}

export interface VersionDifference {
  field: string;
  valueA: unknown;
  valueB: unknown;
  significance: 'minor' | 'moderate' | 'major';
}

export interface CompareVersionsResponse {
  systemA: SystemCard;
  systemB: SystemCard;
  differences: VersionDifference[];
  summary: string;
}

export interface GenerateBlueprintParams {
  systemCardId: string;
  studyIntent: StudyIntent;
  additionalContext?: string;
  targetPopulation?: string;
  availableData?: string[];
}

export interface UpdateBlueprintParams {
  studyIntent?: StudyIntent;
  researchAims?: string[];
  hypotheses?: string[];
  dataDictionary?: DataDictionaryEntry[];
  outcomes?: OutcomeDefinition[];
  inclusionCriteria?: string[];
  exclusionCriteria?: string[];
  analysisPlan?: AnalysisMethod[];
  validationMetrics?: ValidationMetric[];
  sensitivityAnalyses?: string[];
  limitations?: string[];
  reportingChecklist?: string[];
  status?: BlueprintStatus;
}

export interface SummarizeGuidelineResponse {
  summary: string;
  systemCard: SystemCard;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

// =============================================================================
// API Client
// =============================================================================

export class GuidelinesApiClient {
  private baseUrl: string;
  private authToken?: string;

  constructor(baseUrl: string, authToken?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.authToken = authToken;
  }

  /**
   * Set or update the authentication token
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Clear the authentication token
   */
  clearAuthToken(): void {
    this.authToken = undefined;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`,
      }));
      throw new GuidelinesApiError(error.error, response.status, error.code, error.details);
    }

    return response.json();
  }

  // ===========================================================================
  // Search & Discovery
  // ===========================================================================

  /**
   * Search for system cards (scoring systems, staging criteria, etc.)
   */
  async searchSystemCards(params: SearchSystemCardsParams = {}): Promise<SearchSystemCardsResponse> {
    const queryParams = new URLSearchParams();

    if (params.query) queryParams.set('query', params.query);
    if (params.type) queryParams.set('type', params.type);
    if (params.specialty) queryParams.set('specialty', params.specialty);
    if (params.condition) queryParams.set('condition', params.condition);
    if (params.intendedUse) queryParams.set('intendedUse', params.intendedUse);
    if (params.status) queryParams.set('status', params.status);
    if (params.verified !== undefined) queryParams.set('verified', String(params.verified));
    if (params.limit) queryParams.set('limit', String(params.limit));
    if (params.offset) queryParams.set('offset', String(params.offset));

    const query = queryParams.toString();
    return this.request<SearchSystemCardsResponse>(
      'GET',
      `/api/guidelines/search${query ? `?${query}` : ''}`
    );
  }

  /**
   * Get a specific system card with all details (rule specs, evidence, versions)
   */
  async getSystemCard(id: string): Promise<SystemCardWithDetails> {
    return this.request<SystemCardWithDetails>('GET', `/api/guidelines/${id}`);
  }

  /**
   * Get AI-generated summary of a guideline/system
   */
  async summarizeGuideline(id: string): Promise<SummarizeGuidelineResponse> {
    return this.request<SummarizeGuidelineResponse>('GET', `/api/guidelines/${id}/summarize`);
  }

  // ===========================================================================
  // Calculation
  // ===========================================================================

  /**
   * Calculate a score/stage using the specified system card
   */
  async calculateScore(
    systemCardId: string,
    inputs: Record<string, unknown>,
    context: CalculationContext = 'research'
  ): Promise<CalculateScoreResponse> {
    return this.request<CalculateScoreResponse>('POST', '/api/guidelines/calculate', {
      systemCardId,
      inputs,
      context,
    });
  }

  // ===========================================================================
  // Version Comparison
  // ===========================================================================

  /**
   * Compare two versions of a system card
   */
  async compareVersions(
    systemCardIdA: string,
    systemCardIdB: string
  ): Promise<CompareVersionsResponse> {
    return this.request<CompareVersionsResponse>('POST', '/api/guidelines/compare', {
      systemCardIdA,
      systemCardIdB,
    });
  }

  // ===========================================================================
  // Validation Blueprint (Ideation)
  // ===========================================================================

  /**
   * Generate a validation study blueprint for a system card
   */
  async generateBlueprint(params: GenerateBlueprintParams): Promise<ValidationBlueprint> {
    return this.request<ValidationBlueprint>('POST', '/api/guidelines/ideate', params as unknown as Record<string, unknown>);
  }

  /**
   * Get an existing blueprint
   */
  async getBlueprint(id: string): Promise<ValidationBlueprint> {
    return this.request<ValidationBlueprint>('GET', `/api/guidelines/blueprints/${id}`);
  }

  /**
   * Update a blueprint
   */
  async updateBlueprint(id: string, params: UpdateBlueprintParams): Promise<ValidationBlueprint> {
    return this.request<ValidationBlueprint>('PATCH', `/api/guidelines/blueprints/${id}`, params as unknown as Record<string, unknown>);
  }

  /**
   * List blueprints for a system card
   */
  async listBlueprints(systemCardId: string): Promise<ValidationBlueprint[]> {
    return this.request<ValidationBlueprint[]>(
      'GET',
      `/api/guidelines/${systemCardId}/blueprints`
    );
  }
}

// =============================================================================
// Error Class
// =============================================================================

export class GuidelinesApiError extends Error {
  public statusCode: number;
  public code?: string;
  public details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    code?: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'GuidelinesApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

// =============================================================================
// React Hooks (for React frontends)
// =============================================================================

/**
 * React hook factory for Guidelines API
 *
 * Usage:
 * ```typescript
 * const { useSystemCards, useCalculateScore } = createGuidelinesHooks(client);
 *
 * function MyComponent() {
 *   const { data, loading, error } = useSystemCards({ specialty: 'Cardiology' });
 *   // ...
 * }
 * ```
 */
export function createGuidelinesHooks(client: GuidelinesApiClient) {
  // This is a hook factory - returns hook functions that can be used in React components
  // Actual implementation depends on the React query library used (React Query, SWR, etc.)

  return {
    /**
     * Hook for searching system cards
     * Requires React Query or similar library to be configured
     */
    useSystemCardsQuery: (params: SearchSystemCardsParams) => ({
      queryKey: ['guidelines', 'search', params],
      queryFn: () => client.searchSystemCards(params),
    }),

    /**
     * Hook for getting a system card with details
     */
    useSystemCardQuery: (id: string) => ({
      queryKey: ['guidelines', 'card', id],
      queryFn: () => client.getSystemCard(id),
      enabled: !!id,
    }),

    /**
     * Hook for calculating a score (mutation)
     */
    useCalculateScoreMutation: () => ({
      mutationFn: (params: CalculateScoreParams) =>
        client.calculateScore(params.systemCardId, params.inputs, params.context),
    }),

    /**
     * Hook for generating a blueprint (mutation)
     */
    useGenerateBlueprintMutation: () => ({
      mutationFn: (params: GenerateBlueprintParams) => client.generateBlueprint(params),
    }),
  };
}

// =============================================================================
// Default Export
// =============================================================================

export default GuidelinesApiClient;
