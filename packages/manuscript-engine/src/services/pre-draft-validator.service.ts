export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'data' | 'citation' | 'statistics' | 'phi';
  message: string;
  section?: string;
  suggestion?: string;
}

export interface HumanAttestation {
  userId: string;
  timestamp: Date;
  attestedTo: string;
  signature: string;
}

export interface PreDraftValidationResult {
  canProceed: boolean;
  issues: ValidationIssue[];
  attestationsRequired: string[];
  attestationsProvided: HumanAttestation[];
}

export class PreDraftValidatorService {
  validateBeforeDraft(params: {
    manuscriptId: string;
    dataSources: Array<{ id: string; phiScanned: boolean; statisticsValid: boolean }>;
    citations: Array<{ id: string; resolved: boolean }>;
    sections: Array<{ name: string; hasContent: boolean; hasCitations: boolean }>;
    attestations?: HumanAttestation[];
  }): PreDraftValidationResult {
    const issues: ValidationIssue[] = [];
    const attestationsRequired: string[] = [];

    // Data completeness check
    if (params.dataSources.length === 0) {
      issues.push({
        severity: 'warning',
        category: 'data',
        message: 'No data sources linked to manuscript',
        suggestion: 'Add data sources before generating draft'
      });
    }

    // PHI scanning validation
    const unscannedData = params.dataSources.filter(d => !d.phiScanned);
    if (unscannedData.length > 0) {
      issues.push({
        severity: 'error',
        category: 'phi',
        message: `${unscannedData.length} data sources not scanned for PHI`,
        suggestion: 'Run PHI scan on all data sources'
      });
    }

    // Statistical accuracy check
    const invalidStats = params.dataSources.filter(d => !d.statisticsValid);
    if (invalidStats.length > 0) {
      issues.push({
        severity: 'warning',
        category: 'statistics',
        message: `${invalidStats.length} data sources have invalid statistics`
      });
    }

    // Citation integrity
    const unresolvedCitations = params.citations.filter(c => !c.resolved);
    if (unresolvedCitations.length > 0) {
      issues.push({
        severity: 'warning',
        category: 'citation',
        message: `${unresolvedCitations.length} unresolved citations`,
        suggestion: 'Resolve all citations before draft'
      });
    }

    // Human attestation for sensitive sections
    const sensitiveSections = params.sections.filter(s =>
      ['results', 'methods'].includes(s.name.toLowerCase())
    );
    if (sensitiveSections.some(s => s.hasContent)) {
      attestationsRequired.push('data_accuracy_attestation');
    }

    const canProceed = !issues.some(i => i.severity === 'error') &&
      attestationsRequired.every(req =>
        params.attestations?.some(att => att.attestedTo === req)
      );

    return {
      canProceed,
      issues,
      attestationsRequired,
      attestationsProvided: params.attestations || []
    };
  }

  createAttestation(params: {
    userId: string;
    attestedTo: string;
    statement: string;
  }): HumanAttestation {
    return {
      userId: params.userId,
      timestamp: new Date(),
      attestedTo: params.attestedTo,
      signature: `${params.userId}:${params.attestedTo}:${new Date().toISOString()}`
    };
  }
}

export const preDraftValidatorService = new PreDraftValidatorService();
