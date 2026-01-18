/**
 * Dataset Lifecycle State Management
 * 
 * Mirrors the governance model from ros-backend/src/governance/lifecycle_states.py
 * Enforces explicit transition graph with human attestation gates.
 */

import type { WorkflowStage } from "@packages/core/types";

export type LifecycleState =
  | 'DRAFT'
  | 'SPEC_DEFINED'
  | 'EXTRACTION_COMPLETE'
  | 'QA_PASSED'
  | 'QA_FAILED'
  | 'LINKED'
  | 'ANALYSIS_READY'
  | 'IN_ANALYSIS'
  | 'ANALYSIS_COMPLETE'
  | 'FROZEN'
  | 'ARCHIVED';

export interface StateTransition {
  from: LifecycleState;
  to: LifecycleState;
  timestamp: string;
  attestedBy?: string;
  reason?: string;
}

export type AuditAction = 
  | 'STATE_CHANGE' 
  | 'STAGE_EXECUTED' 
  | 'ATTESTATION_PROVIDED' 
  | 'GATE_BLOCKED'
  | 'AI_CALL_APPROVED'
  | 'AI_CALL_BLOCKED'
  | 'AI_CALL_EXECUTED';

// =============================================================================
// AI CALL APPROVAL SYSTEM
// =============================================================================

/**
 * AI Approval Mode determines how AI calls are approved by the user.
 * - REQUIRE_EACH: Require individual approval before EACH AI call execution
 * - APPROVE_PHASE: Approve all AI calls within a pipeline phase at once
 * - APPROVE_SESSION: Approve all AI calls for the entire session upfront
 */
export type AIApprovalMode = 'REQUIRE_EACH' | 'APPROVE_PHASE' | 'APPROVE_SESSION';

export const AI_APPROVAL_MODE_LABELS: Record<AIApprovalMode, string> = {
  REQUIRE_EACH: 'Per-Call Approval',
  APPROVE_PHASE: 'Phase-Level Approval',
  APPROVE_SESSION: 'Session-Wide Approval',
};

export const AI_APPROVAL_MODE_DESCRIPTIONS: Record<AIApprovalMode, string> = {
  REQUIRE_EACH: 'Require explicit approval before each individual AI tool execution',
  APPROVE_PHASE: 'Approve all AI tools within a phase at once when entering that phase',
  APPROVE_SESSION: 'Approve all AI tools for the entire research session upfront',
};

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  stateFrom?: LifecycleState;
  stateTo?: LifecycleState;
  stageId?: number;
  stageName?: string;
  attestedBy?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  // AI-specific fields
  aiModel?: string;
  aiProvider?: string;
  aiCostEstimate?: string;
  approvalMode?: AIApprovalMode;
}

export interface AITool {
  id: string;
  name: string;
  description: string;
  model: string;
  provider: string;
  costEstimate: string;
  phiRisk: 'low' | 'medium' | 'high';
}

export interface PhaseAIConfig {
  phaseId: string;
  phaseName: string;
  stages: number[];
  aiTools: AITool[];
  requiresApproval: boolean;
}

// Map of stages that use AI and their tools
export const AI_ENABLED_STAGES: Record<number, AITool[]> = {
  2: [{ id: 'literature-search', name: 'Literature Search', description: 'Search PubMed, Embase, Cochrane for relevant papers', model: 'GPT-4o', provider: 'OpenAI', costEstimate: '$0.05-0.15', phiRisk: 'low' }],
  3: [{ id: 'irb-generation', name: 'IRB Proposal Generator', description: 'Generate draft IRB application from research scope', model: 'GPT-4o', provider: 'OpenAI', costEstimate: '$0.10-0.25', phiRisk: 'low' }],
  4: [{ id: 'extraction-plan', name: 'Extraction Plan', description: 'Generate data extraction variables from literature', model: 'GPT-4o', provider: 'OpenAI', costEstimate: '$0.05-0.15', phiRisk: 'low' }],
  5: [{ id: 'phi-detection', name: 'PHI Detection', description: 'Scan dataset for protected health information', model: 'GPT-4o', provider: 'OpenAI', costEstimate: '$0.15-0.30', phiRisk: 'high' }],
  9: [{ id: 'summary-stats', name: 'Summary Statistics', description: 'Generate baseline characteristics table', model: 'GPT-4o', provider: 'OpenAI', costEstimate: '$0.05-0.10', phiRisk: 'medium' }],
  10: [{ id: 'gap-analysis', name: 'Literature Gap Analysis', description: 'Identify research gaps and opportunities', model: 'GPT-4o', provider: 'OpenAI', costEstimate: '$0.10-0.20', phiRisk: 'low' }],
  11: [{ id: 'manuscript-ideation', name: 'Manuscript Ideation', description: 'Generate 5-10 manuscript proposals with scores', model: 'GPT-4o', provider: 'OpenAI', costEstimate: '$0.15-0.30', phiRisk: 'low' }],
  13: [{ id: 'statistical-analysis', name: 'Statistical Analysis', description: 'Automated statistical tests and modeling', model: 'GPT-4o', provider: 'OpenAI', costEstimate: '$0.20-0.40', phiRisk: 'medium' }],
  14: [{ id: 'manuscript-draft', name: 'Manuscript Drafting', description: 'AI-assisted manuscript generation', model: 'GPT-4o', provider: 'OpenAI', costEstimate: '$0.25-0.50', phiRisk: 'medium' }],
  15: [{ id: 'manuscript-polish', name: 'Manuscript Polish', description: 'Refine language, formatting, and flow', model: 'GPT-4o', provider: 'OpenAI', costEstimate: '$0.10-0.20', phiRisk: 'low' }],
  16: [{ id: 'journal-recommend', name: 'Journal Recommendations', description: 'AI-powered journal matching and submission prep', model: 'GPT-4o', provider: 'OpenAI', costEstimate: '$0.10-0.20', phiRisk: 'low' }],
};

// Phase-level AI approval configuration
export const PHASE_AI_CONFIG: PhaseAIConfig[] = [
  {
    phaseId: 'data-preparation',
    phaseName: 'Data Preparation',
    stages: [2, 3, 4],
    aiTools: [
      AI_ENABLED_STAGES[2]![0],
      AI_ENABLED_STAGES[3]![0],
      AI_ENABLED_STAGES[4]![0],
    ],
    requiresApproval: true,
  },
  {
    phaseId: 'data-processing',
    phaseName: 'Data Processing & Validation',
    stages: [5],
    aiTools: [AI_ENABLED_STAGES[5]![0]],
    requiresApproval: true, // High PHI risk
  },
  {
    phaseId: 'analysis-ideation',
    phaseName: 'Analysis & Ideation',
    stages: [9, 10, 11],
    aiTools: [
      AI_ENABLED_STAGES[9]![0],
      AI_ENABLED_STAGES[10]![0],
      AI_ENABLED_STAGES[11]![0],
    ],
    requiresApproval: true,
  },
  {
    phaseId: 'manuscript-development',
    phaseName: 'Manuscript Development',
    stages: [13, 14],
    aiTools: [
      AI_ENABLED_STAGES[13]![0],
      AI_ENABLED_STAGES[14]![0],
    ],
    requiresApproval: true,
  },
  {
    phaseId: 'finalization',
    phaseName: 'Finalization',
    stages: [15, 16],
    aiTools: [
      AI_ENABLED_STAGES[15]![0],
      AI_ENABLED_STAGES[16]![0],
    ],
    requiresApproval: true,
  },
];

export function getAIToolsForStage(stageId: number): AITool[] {
  return AI_ENABLED_STAGES[stageId] || [];
}

export function stageUsesAI(stageId: number): boolean {
  return stageId in AI_ENABLED_STAGES;
}

export function getPhaseForStage(stageId: number): PhaseAIConfig | null {
  return PHASE_AI_CONFIG.find(phase => phase.stages.includes(stageId)) || null;
}

export function hasHighPHIRisk(stageId: number): boolean {
  const tools = getAIToolsForStage(stageId);
  return tools.some(tool => tool.phiRisk === 'high');
}

export interface AttestationGate {
  targetState: LifecycleState;
  title: string;
  description: string;
  checklistItems: string[];
  requiredForStages: number[];
}

export const ALLOWED_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  DRAFT: ['SPEC_DEFINED'],
  SPEC_DEFINED: ['EXTRACTION_COMPLETE'],
  EXTRACTION_COMPLETE: ['QA_PASSED', 'QA_FAILED'],
  QA_PASSED: ['LINKED', 'ANALYSIS_READY'],
  QA_FAILED: ['EXTRACTION_COMPLETE'],
  LINKED: ['ANALYSIS_READY'],
  ANALYSIS_READY: ['IN_ANALYSIS', 'FROZEN'],
  IN_ANALYSIS: ['ANALYSIS_COMPLETE', 'ANALYSIS_READY'],
  ANALYSIS_COMPLETE: ['FROZEN', 'ARCHIVED'],
  FROZEN: ['ARCHIVED'],
  ARCHIVED: [],
};

export const HUMAN_ATTESTATION_REQUIRED: LifecycleState[] = [
  'QA_PASSED',
  'ANALYSIS_READY',
  'FROZEN',
];

export const IMMUTABLE_STATES: LifecycleState[] = ['FROZEN', 'ARCHIVED'];

export const TERMINAL_STATES: LifecycleState[] = ['ARCHIVED'];

export const STATE_METADATA: Record<LifecycleState, { 
  label: string; 
  description: string; 
  color: string;
  icon: string;
}> = {
  DRAFT: { 
    label: 'Draft', 
    description: 'Initial state - defining research scope',
    color: 'text-muted-foreground',
    icon: 'FileEdit'
  },
  SPEC_DEFINED: { 
    label: 'Spec Defined', 
    description: 'Research specifications documented',
    color: 'text-ros-primary',
    icon: 'FileText'
  },
  EXTRACTION_COMPLETE: { 
    label: 'Extraction Complete', 
    description: 'Data extracted and ready for QA',
    color: 'text-ros-workflow',
    icon: 'Database'
  },
  QA_PASSED: { 
    label: 'QA Passed', 
    description: 'Quality assurance validated',
    color: 'text-ros-success',
    icon: 'CheckCircle'
  },
  QA_FAILED: { 
    label: 'QA Failed', 
    description: 'Quality issues detected - remediation required',
    color: 'text-ros-alert',
    icon: 'AlertTriangle'
  },
  LINKED: { 
    label: 'Linked', 
    description: 'Dataset linked to external sources',
    color: 'text-ros-workflow',
    icon: 'Link'
  },
  ANALYSIS_READY: { 
    label: 'Analysis Ready', 
    description: 'Dataset validated and ready for analysis',
    color: 'text-ros-success',
    icon: 'PlayCircle'
  },
  IN_ANALYSIS: { 
    label: 'In Analysis', 
    description: 'Active statistical analysis in progress',
    color: 'text-ros-workflow',
    icon: 'Loader2'
  },
  ANALYSIS_COMPLETE: { 
    label: 'Analysis Complete', 
    description: 'All analyses finalized',
    color: 'text-ros-success',
    icon: 'CheckCircle2'
  },
  FROZEN: { 
    label: 'Frozen', 
    description: 'Immutable - ready for publication',
    color: 'text-blue-500',
    icon: 'Lock'
  },
  ARCHIVED: { 
    label: 'Archived', 
    description: 'Terminal state - permanently stored',
    color: 'text-muted-foreground',
    icon: 'Archive'
  },
};

export const ATTESTATION_GATES: AttestationGate[] = [
  {
    targetState: 'QA_PASSED',
    title: 'Confirm Data is Ready for PHI Scanning',
    description: 'Before PHI scanning begins, please verify the following:',
    checklistItems: [
      'Data source has been verified as authorized for research use',
      'Dataset contains the expected number of records and variables',
      'No obvious data corruption or formatting issues have been observed',
      'I understand PHI detection will scan for protected health information',
      'I am ready to proceed with PHI detection scanning',
    ],
    requiredForStages: [5], // PHI Scan
  },
  {
    targetState: 'ANALYSIS_READY',
    title: 'Confirm Dataset is PHI-Clean and Validated',
    description: 'Before analysis can begin, please verify the following:',
    checklistItems: [
      'Dataset has been de-identified and is confirmed PHI-free',
      'All data validation checks have passed successfully',
      'Variable definitions match the extraction protocol',
      'Data quality metrics meet acceptable thresholds',
      'I am ready to proceed with statistical analysis',
    ],
    requiredForStages: [9, 10, 11, 13], // Summary, Gap Analysis, Ideation, Statistics
  },
  {
    targetState: 'FROZEN',
    title: 'Confirm Manuscript Finalization',
    description: 'Before finalizing the manuscript, please confirm:',
    checklistItems: [
      'Statistical analysis has been reviewed for accuracy',
      'All figures and tables are publication-ready',
      'Co-author review has been completed',
      'Ready to freeze dataset for submission',
    ],
    requiredForStages: [14, 15], // Drafting, Polish
  },
];

export function isValidTransition(from: LifecycleState, to: LifecycleState): boolean {
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export function requiresAttestation(state: LifecycleState): boolean {
  return HUMAN_ATTESTATION_REQUIRED.includes(state);
}

export function isImmutable(state: LifecycleState): boolean {
  return IMMUTABLE_STATES.includes(state);
}

export function isTerminal(state: LifecycleState): boolean {
  return TERMINAL_STATES.includes(state);
}

export function getAllowedNextStates(state: LifecycleState): LifecycleState[] {
  return ALLOWED_TRANSITIONS[state] || [];
}

export function getAttestationGateForStage(stageId: number): AttestationGate | null {
  return ATTESTATION_GATES.find(gate => gate.requiredForStages.includes(stageId)) || null;
}

export function stageRequiresAttestation(stageId: number): boolean {
  return ATTESTATION_GATES.some(gate => gate.requiredForStages.includes(stageId));
}

/**
 * Maps workflow stages to lifecycle states.
 * Aligned with backend governance to ensure valid state transitions.
 * 
 * Stage Flow:
 * 1 Topic Declaration → DRAFT
 * 2-3 Literature/IRB → SPEC_DEFINED  
 * 4 Planned Extraction → EXTRACTION_COMPLETE
 * 5-8 PHI Scan/Schema/Scrub/Validate → QA_PASSED (attestation required to enter)
 * 9-11 Summary/Gap/Ideation → ANALYSIS_READY (attestation required to enter)
 * 12 Manuscript Selection → ANALYSIS_READY (continues analysis phase)
 * 13 Statistics → IN_ANALYSIS
 * 14 Drafting → ANALYSIS_COMPLETE
 * 15-16 Polish/Submission → FROZEN (attestation required to enter)
 * 17-19 Conference → FROZEN (optional, stays frozen until archived)
 */
export function mapStageToLifecycleState(stageId: number): LifecycleState {
  if (stageId === 1) return 'DRAFT';
  if (stageId === 2 || stageId === 3) return 'SPEC_DEFINED';
  if (stageId === 4) return 'EXTRACTION_COMPLETE';
  if (stageId >= 5 && stageId <= 8) return 'QA_PASSED';
  if (stageId >= 9 && stageId <= 12) return 'ANALYSIS_READY';
  if (stageId === 13) return 'IN_ANALYSIS';
  if (stageId === 14) return 'ANALYSIS_COMPLETE';
  if (stageId >= 15 && stageId <= 19) return 'FROZEN';
  return 'ARCHIVED';
}

/**
 * Get the next valid state based on current state.
 * Used to determine if a stage can advance the lifecycle.
 */
export function getNextValidState(currentState: LifecycleState, targetState: LifecycleState): LifecycleState | null {
  // If same state, no transition needed
  if (currentState === targetState) return targetState;
  
  // Check if direct transition is valid
  if (isValidTransition(currentState, targetState)) {
    return targetState;
  }
  
  // Otherwise, return the first allowed transition from current state
  const nextStates = getAllowedNextStates(currentState);
  return nextStates.length > 0 ? nextStates[0] : null;
}

/**
 * Check if stage execution should be allowed based on current lifecycle state.
 */
export function canExecuteInCurrentState(stageId: number, currentState: LifecycleState): boolean {
  const targetState = mapStageToLifecycleState(stageId);
  
  // Same state - allowed (multiple stages can run in same state)
  if (currentState === targetState) return true;
  
  // Valid transition - allowed
  if (isValidTransition(currentState, targetState)) return true;
  
  // Invalid transition - check if we need intermediate states
  return false;
}

// =============================================================================
// PHI GATE ENFORCEMENT SYSTEM
// =============================================================================

/**
 * PHI Status represents the current state of PHI scanning/compliance.
 * Follows the same enum pattern as LifecycleState for consistency.
 */
export type PhiStatus =
  | 'UNCHECKED'     // Not yet scanned
  | 'SCANNING'      // Scan in progress
  | 'PASS'          // No PHI detected
  | 'FAIL'          // PHI detected, blocked
  | 'QUARANTINED'   // PHI found, isolated for remediation
  | 'OVERRIDDEN';   // Human override with justification

export const PHI_STATUS_METADATA: Record<PhiStatus, {
  label: string;
  description: string;
  color: string;
  bgColor: string;
  icon: string;
  canProceed: boolean;
}> = {
  UNCHECKED: {
    label: 'Unchecked',
    description: 'Content has not been scanned for PHI',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    icon: 'HelpCircle',
    canProceed: false,
  },
  SCANNING: {
    label: 'Scanning',
    description: 'PHI scan in progress',
    color: 'text-ros-workflow',
    bgColor: 'bg-ros-workflow/10',
    icon: 'Loader2',
    canProceed: false,
  },
  PASS: {
    label: 'PHI-Free',
    description: 'No protected health information detected',
    color: 'text-ros-success',
    bgColor: 'bg-ros-success/10',
    icon: 'ShieldCheck',
    canProceed: true,
  },
  FAIL: {
    label: 'PHI Detected',
    description: 'Protected health information found - remediation required',
    color: 'text-ros-alert',
    bgColor: 'bg-ros-alert/10',
    icon: 'ShieldAlert',
    canProceed: false,
  },
  QUARANTINED: {
    label: 'Quarantined',
    description: 'PHI isolated for remediation',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    icon: 'AlertTriangle',
    canProceed: false,
  },
  OVERRIDDEN: {
    label: 'Override',
    description: 'PHI check bypassed with justification',
    color: 'text-amber-600',
    bgColor: 'bg-amber-600/10',
    icon: 'ShieldOff',
    canProceed: true,
  },
};

/**
 * PHI finding types based on HIPAA 18 identifiers
 */
export type PhiFindingType =
  | 'NAME'
  | 'DATE'
  | 'PHONE'
  | 'FAX'
  | 'EMAIL'
  | 'SSN'
  | 'MRN'
  | 'HEALTH_PLAN'
  | 'ACCOUNT'
  | 'LICENSE'
  | 'VEHICLE'
  | 'DEVICE'
  | 'URL'
  | 'IP_ADDRESS'
  | 'BIOMETRIC'
  | 'PHOTO'
  | 'GEOGRAPHIC'
  | 'OTHER';

export interface PhiFinding {
  id: string;
  type: PhiFindingType;
  value: string;
  location: string; // e.g., "column: patient_name" or "row 42"
  confidence: number; // 0-1
  context?: string;
}

export interface PhiScanResult {
  id: string;
  timestamp: string;
  status: PhiStatus;
  findings: PhiFinding[];
  scanScope: string; // What was scanned
  durationMs: number;
  datasetHash?: string;
}

export interface PhiOverride {
  id: string;
  timestamp: string;
  user: string;
  justification: string;
  originalFindings: PhiFinding[];
  previousStatus: PhiStatus;
}

export type PhiAuditAction =
  | 'PHI_SCAN_STARTED'
  | 'PHI_SCAN_COMPLETED'
  | 'PHI_DETECTED'
  | 'PHI_QUARANTINED'
  | 'PHI_REMEDIATED'
  | 'PHI_OVERRIDE_REQUESTED'
  | 'PHI_OVERRIDE_APPROVED'
  | 'PHI_GATE_BLOCKED'
  | 'PHI_GATE_PASSED';

export interface PhiAuditLogEntry {
  id: string;
  timestamp: string;
  action: PhiAuditAction;
  status: PhiStatus;
  stageId?: number;
  stageName?: string;
  gatePosition?: string;
  findings?: PhiFinding[];
  overrideJustification?: string;
  user?: string;
  metadata?: Record<string, unknown>;
}

/**
 * PHI Gate positions in the workflow - mandatory checkpoints
 */
export const PHI_GATE_POSITIONS: {
  id: string;
  name: string;
  description: string;
  beforeStages: number[];
  scanScope: string[];
}[] = [
  {
    id: 'gate-analysis',
    name: 'Pre-Analysis Gate',
    description: 'PHI scan required before data enters analysis',
    beforeStages: [9], // Before Summary Characteristics
    scanScope: ['dataset', 'column_names', 'uploaded_files'],
  },
  {
    id: 'gate-generation',
    name: 'Pre-Generation Gate',
    description: 'PHI scan required before table/figure generation',
    beforeStages: [13, 14], // Before Statistical Analysis and Manuscript Drafting
    scanScope: ['analysis_inputs', 'free_text', 'notes'],
  },
  {
    id: 'gate-export',
    name: 'Pre-Export Gate',
    description: 'PHI scan required before any export',
    beforeStages: [17, 18, 19], // Before Poster, Symposium, Presentation
    scanScope: ['manuscript', 'figures', 'tables', 'abstracts', 'filenames'],
  },
];

/**
 * Check if a stage requires a PHI gate check
 */
export function stageRequiresPhiGate(stageId: number): boolean {
  return PHI_GATE_POSITIONS.some(gate => gate.beforeStages.includes(stageId));
}

/**
 * Get the PHI gate for a stage
 */
export function getPhiGateForStage(stageId: number): typeof PHI_GATE_POSITIONS[0] | null {
  return PHI_GATE_POSITIONS.find(gate => gate.beforeStages.includes(stageId)) || null;
}

/**
 * Check if PHI status allows proceeding
 */
export function canProceedWithPhiStatus(status: PhiStatus): boolean {
  return PHI_STATUS_METADATA[status].canProceed;
}

/**
 * Generate PHI audit entry
 */
export function createPhiAuditEntry(
  action: PhiAuditAction,
  status: PhiStatus,
  details: Partial<PhiAuditLogEntry>
): PhiAuditLogEntry {
  return {
    id: `phi-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
    action,
    status,
    ...details,
  };
}

/**
 * Validate override justification meets minimum requirements
 */
export function isValidOverrideJustification(justification: string): boolean {
  return justification.trim().length >= 20;
}

export function generateAuditId(): string {
  return `audit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function createAuditEntry(
  action: AuditLogEntry['action'],
  details: Partial<AuditLogEntry>
): AuditLogEntry {
  return {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    action,
    ...details,
  };
}

// =============================================================================
// TOPIC VERSION TRACKING FOR STAGES (INF-22)
// =============================================================================

/**
 * Check if a stage's output is outdated because the topic version
 * has changed since the stage was executed.
 * 
 * @param stage - The workflow stage to check
 * @param currentTopicVersion - The current topic version hash
 * @returns true if the stage was executed with an older topic version
 */
export function isStageOutdated(
  stage: WorkflowStage,
  currentTopicVersion: string
): boolean {
  if (stage.status !== 'completed') {
    return false;
  }
  
  if (!stage.topicVersionAtExecution) {
    return false;
  }
  
  return stage.topicVersionAtExecution !== currentTopicVersion;
}

/**
 * Get the topic version hash that was active when a stage was executed.
 * Returns null if the stage hasn't been executed or doesn't track version.
 * 
 * @param stage - The workflow stage
 * @returns The topic version hash or null
 */
export function getStageTopicVersion(stage: WorkflowStage): string | null {
  if (stage.status !== 'completed') {
    return null;
  }
  
  return stage.topicVersionAtExecution || null;
}

/**
 * Get all downstream stages that are outdated compared to current topic version.
 * 
 * @param stages - Array of workflow stages
 * @param currentTopicVersion - The current topic version hash
 * @returns Array of stage IDs that are outdated
 */
export function getOutdatedStages(
  stages: WorkflowStage[],
  currentTopicVersion: string
): number[] {
  return stages
    .filter(stage => isStageOutdated(stage, currentTopicVersion))
    .map(stage => stage.id);
}

/**
 * Check if any completed stages would be affected by a topic change.
 * Used to warn users before modifying the topic.
 * 
 * @param stages - Array of workflow stages
 * @returns true if any stages have been executed
 */
export function hasExecutedDownstreamStages(stages: WorkflowStage[]): boolean {
  return stages.some(
    stage => stage.status === 'completed' && stage.topicVersionAtExecution
  );
}
