/**
 * ValidationPlanner Component
 *
 * Interactive validation study planning interface for clinical scoring systems.
 * Helps researchers design validation studies with proper methodology.
 *
 * Features:
 * - Study intent selection (external validation, temporal, etc.)
 * - Research aims and hypotheses editor
 * - Data dictionary builder
 * - Analysis plan generator
 * - TRIPOD/STARD checklist integration
 */

import React, { useState, useCallback } from 'react';
import type {
  SystemCard,
  ValidationBlueprint,
  StudyIntent,
  DataDictionaryEntry,
  OutcomeDefinition,
  AnalysisMethod,
  ValidationMetric,
  GenerateBlueprintParams,
} from '../../api/guidelines-api';

// =============================================================================
// Types
// =============================================================================

export interface ValidationPlannerProps {
  /** The system card to plan validation for */
  systemCard: SystemCard;
  /** Existing blueprint (for editing) */
  existingBlueprint?: ValidationBlueprint;
  /** Callback to generate a new blueprint */
  onGenerate?: (params: GenerateBlueprintParams) => Promise<ValidationBlueprint>;
  /** Callback when blueprint is updated */
  onUpdate?: (blueprint: Partial<ValidationBlueprint>) => void;
  /** Callback to export/finalize blueprint */
  onExport?: (blueprint: ValidationBlueprint) => void;
  /** Custom class name */
  className?: string;
}

type PlannerStep = 'intent' | 'aims' | 'data' | 'outcomes' | 'analysis' | 'review';

// =============================================================================
// Constants
// =============================================================================

const STUDY_INTENTS: { value: StudyIntent; label: string; description: string }[] = [
  {
    value: 'external_validation',
    label: 'External Validation',
    description: 'Validate the model in a new, independent population',
  },
  {
    value: 'temporal_validation',
    label: 'Temporal Validation',
    description: 'Validate using data from a different time period',
  },
  {
    value: 'subgroup_validation',
    label: 'Subgroup Validation',
    description: 'Assess performance in specific patient subgroups',
  },
  {
    value: 'head_to_head',
    label: 'Head-to-Head Comparison',
    description: 'Compare this model against another prediction model',
  },
  {
    value: 'recalibration',
    label: 'Recalibration Study',
    description: 'Update model coefficients for a new population',
  },
  {
    value: 'simplification',
    label: 'Simplification Study',
    description: 'Develop a simplified version with fewer variables',
  },
  {
    value: 'fairness',
    label: 'Fairness Assessment',
    description: 'Evaluate model performance across demographic groups',
  },
];

const STEPS: { key: PlannerStep; label: string }[] = [
  { key: 'intent', label: 'Study Intent' },
  { key: 'aims', label: 'Aims & Hypotheses' },
  { key: 'data', label: 'Data Dictionary' },
  { key: 'outcomes', label: 'Outcomes' },
  { key: 'analysis', label: 'Analysis Plan' },
  { key: 'review', label: 'Review & Export' },
];

// =============================================================================
// Styles
// =============================================================================

const styles = {
  container: 'max-w-5xl mx-auto bg-white rounded-lg shadow-lg',
  header: 'bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6',
  headerTitle: 'text-2xl font-bold',
  headerSubtitle: 'text-purple-200 mt-1',
  progress: 'flex items-center justify-between px-6 py-4 bg-gray-50 border-b',
  progressStep: 'flex items-center gap-2',
  progressDot: 'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
  progressDotActive: 'bg-purple-600 text-white',
  progressDotComplete: 'bg-green-500 text-white',
  progressDotPending: 'bg-gray-200 text-gray-500',
  progressLabel: 'text-sm text-gray-600 hidden sm:block',
  progressLine: 'flex-1 h-0.5 bg-gray-200 mx-2',
  progressLineComplete: 'bg-green-500',
  content: 'p-6',
  stepTitle: 'text-xl font-semibold text-gray-900 mb-4',
  stepDescription: 'text-gray-600 mb-6',
  // Intent selection
  intentGrid: 'grid grid-cols-1 md:grid-cols-2 gap-4',
  intentCard: 'border-2 rounded-lg p-4 cursor-pointer transition-all hover:border-purple-300',
  intentCardSelected: 'border-purple-600 bg-purple-50',
  intentCardDefault: 'border-gray-200',
  intentTitle: 'font-medium text-gray-900',
  intentDesc: 'text-sm text-gray-600 mt-1',
  // Forms
  formGroup: 'mb-6',
  formLabel: 'block text-sm font-medium text-gray-700 mb-2',
  formInput: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500',
  formTextarea: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 min-h-[100px]',
  formHint: 'text-xs text-gray-500 mt-1',
  // List items
  listItem: 'flex items-center gap-2 p-3 bg-gray-50 rounded-lg mb-2',
  listItemText: 'flex-1',
  listItemRemove: 'text-red-500 hover:text-red-700 cursor-pointer',
  addButton: 'text-purple-600 hover:text-purple-700 text-sm font-medium cursor-pointer flex items-center gap-1',
  // Data dictionary table
  dataTable: 'w-full border-collapse text-sm',
  dataTableHeader: 'bg-gray-100 text-left',
  dataTableCell: 'border border-gray-200 px-3 py-2',
  // Navigation
  navigation: 'flex justify-between p-6 border-t bg-gray-50',
  navButton: 'px-6 py-2 rounded-md font-medium transition-colors',
  navButtonPrimary: 'bg-purple-600 text-white hover:bg-purple-700',
  navButtonSecondary: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
  // Review
  reviewSection: 'mb-6 p-4 bg-gray-50 rounded-lg',
  reviewTitle: 'font-medium text-gray-900 mb-2',
  reviewContent: 'text-sm text-gray-600',
  reviewList: 'list-disc list-inside space-y-1',
};

// =============================================================================
// Component
// =============================================================================

export const ValidationPlanner: React.FC<ValidationPlannerProps> = ({
  systemCard,
  existingBlueprint,
  onGenerate,
  onUpdate,
  onExport,
  className = '',
}) => {
  // State
  const [currentStep, setCurrentStep] = useState<PlannerStep>('intent');
  const [loading, setLoading] = useState(false);
  const [blueprint, setBlueprint] = useState<Partial<ValidationBlueprint>>(
    existingBlueprint || {
      studyIntent: 'external_validation',
      researchAims: [],
      hypotheses: [],
      dataDictionary: [],
      outcomes: [],
      inclusionCriteria: [],
      exclusionCriteria: [],
      analysisPlan: [],
      validationMetrics: [],
      sensitivityAnalyses: [],
      reportingChecklist: [],
    }
  );

  // Form state for adding items
  const [newAim, setNewAim] = useState('');
  const [newHypothesis, setNewHypothesis] = useState('');
  const [newInclusion, setNewInclusion] = useState('');
  const [newExclusion, setNewExclusion] = useState('');

  // Step index
  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep);

  // Update blueprint
  const updateBlueprint = useCallback(
    (updates: Partial<ValidationBlueprint>) => {
      setBlueprint((prev) => ({ ...prev, ...updates }));
      onUpdate?.(updates);
    },
    [onUpdate]
  );

  // Add/remove list items
  const addListItem = useCallback(
    (key: keyof ValidationBlueprint, value: string, setter: (v: string) => void) => {
      if (!value.trim()) return;
      const current = (blueprint[key] as string[]) || [];
      updateBlueprint({ [key]: [...current, value.trim()] } as Partial<ValidationBlueprint>);
      setter('');
    },
    [blueprint, updateBlueprint]
  );

  const removeListItem = useCallback(
    (key: keyof ValidationBlueprint, index: number) => {
      const current = (blueprint[key] as string[]) || [];
      updateBlueprint({
        [key]: current.filter((_, i) => i !== index),
      } as Partial<ValidationBlueprint>);
    },
    [blueprint, updateBlueprint]
  );

  // Generate blueprint
  const handleGenerate = useCallback(async () => {
    if (!onGenerate || !blueprint.studyIntent) return;

    setLoading(true);
    try {
      const generated = await onGenerate({
        systemCardId: systemCard.id,
        studyIntent: blueprint.studyIntent,
        additionalContext: blueprint.researchAims?.join('. '),
      });
      setBlueprint(generated);
    } catch (err) {
      console.error('Failed to generate blueprint:', err);
    } finally {
      setLoading(false);
    }
  }, [onGenerate, systemCard.id, blueprint.studyIntent, blueprint.researchAims]);

  // Navigation
  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].key);
    }
  };

  const goPrev = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].key);
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'intent':
        return (
          <>
            <h2 className={styles.stepTitle}>Select Study Intent</h2>
            <p className={styles.stepDescription}>
              What type of validation study do you want to conduct for {systemCard.name}?
            </p>
            <div className={styles.intentGrid}>
              {STUDY_INTENTS.map((intent) => (
                <div
                  key={intent.value}
                  onClick={() => updateBlueprint({ studyIntent: intent.value })}
                  className={`${styles.intentCard} ${
                    blueprint.studyIntent === intent.value
                      ? styles.intentCardSelected
                      : styles.intentCardDefault
                  }`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && updateBlueprint({ studyIntent: intent.value })}
                >
                  <h3 className={styles.intentTitle}>{intent.label}</h3>
                  <p className={styles.intentDesc}>{intent.description}</p>
                </div>
              ))}
            </div>
          </>
        );

      case 'aims':
        return (
          <>
            <h2 className={styles.stepTitle}>Research Aims & Hypotheses</h2>
            <p className={styles.stepDescription}>
              Define the specific aims and testable hypotheses for your validation study.
            </p>

            {/* Research Aims */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Research Aims</label>
              {blueprint.researchAims?.map((aim, i) => (
                <div key={i} className={styles.listItem}>
                  <span className={styles.listItemText}>{aim}</span>
                  <button
                    onClick={() => removeListItem('researchAims', i)}
                    className={styles.listItemRemove}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAim}
                  onChange={(e) => setNewAim(e.target.value)}
                  placeholder="e.g., To validate the discriminative ability of..."
                  className={styles.formInput}
                  onKeyDown={(e) => e.key === 'Enter' && addListItem('researchAims', newAim, setNewAim)}
                />
                <button
                  onClick={() => addListItem('researchAims', newAim, setNewAim)}
                  className={`${styles.navButton} ${styles.navButtonSecondary}`}
                >
                  Add
                </button>
              </div>
            </div>

            {/* Hypotheses */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Hypotheses</label>
              {blueprint.hypotheses?.map((hyp, i) => (
                <div key={i} className={styles.listItem}>
                  <span className={styles.listItemText}>{hyp}</span>
                  <button
                    onClick={() => removeListItem('hypotheses', i)}
                    className={styles.listItemRemove}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newHypothesis}
                  onChange={(e) => setNewHypothesis(e.target.value)}
                  placeholder="e.g., The C-index will be ≥0.70 in the validation cohort"
                  className={styles.formInput}
                  onKeyDown={(e) => e.key === 'Enter' && addListItem('hypotheses', newHypothesis, setNewHypothesis)}
                />
                <button
                  onClick={() => addListItem('hypotheses', newHypothesis, setNewHypothesis)}
                  className={`${styles.navButton} ${styles.navButtonSecondary}`}
                >
                  Add
                </button>
              </div>
            </div>

            {onGenerate && (
              <button
                onClick={handleGenerate}
                disabled={loading}
                className={`${styles.navButton} ${styles.navButtonPrimary} mt-4`}
              >
                {loading ? 'Generating...' : '✨ Generate with AI'}
              </button>
            )}
          </>
        );

      case 'data':
        return (
          <>
            <h2 className={styles.stepTitle}>Data Dictionary</h2>
            <p className={styles.stepDescription}>
              Define the variables needed for validation. These are derived from the{' '}
              {systemCard.name} input requirements.
            </p>

            <table className={styles.dataTable}>
              <thead>
                <tr className={styles.dataTableHeader}>
                  <th className={styles.dataTableCell}>Variable</th>
                  <th className={styles.dataTableCell}>Type</th>
                  <th className={styles.dataTableCell}>Required</th>
                  <th className={styles.dataTableCell}>Source</th>
                </tr>
              </thead>
              <tbody>
                {systemCard.inputs.map((input) => (
                  <tr key={input.name}>
                    <td className={styles.dataTableCell}>
                      <strong>{input.name.replace(/_/g, ' ')}</strong>
                      <br />
                      <span className="text-xs text-gray-500">{input.description}</span>
                    </td>
                    <td className={styles.dataTableCell}>{input.type}</td>
                    <td className={styles.dataTableCell}>{input.required ? 'Yes' : 'No'}</td>
                    <td className={styles.dataTableCell}>
                      <input
                        type="text"
                        placeholder="e.g., EMR, Lab system"
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Inclusion Criteria */}
            <div className={`${styles.formGroup} mt-6`}>
              <label className={styles.formLabel}>Inclusion Criteria</label>
              {blueprint.inclusionCriteria?.map((crit, i) => (
                <div key={i} className={styles.listItem}>
                  <span className={styles.listItemText}>{crit}</span>
                  <button onClick={() => removeListItem('inclusionCriteria', i)} className={styles.listItemRemove}>✕</button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newInclusion}
                  onChange={(e) => setNewInclusion(e.target.value)}
                  placeholder="e.g., Adults ≥18 years with documented AF"
                  className={styles.formInput}
                  onKeyDown={(e) => e.key === 'Enter' && addListItem('inclusionCriteria', newInclusion, setNewInclusion)}
                />
                <button onClick={() => addListItem('inclusionCriteria', newInclusion, setNewInclusion)} className={`${styles.navButton} ${styles.navButtonSecondary}`}>Add</button>
              </div>
            </div>

            {/* Exclusion Criteria */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Exclusion Criteria</label>
              {blueprint.exclusionCriteria?.map((crit, i) => (
                <div key={i} className={styles.listItem}>
                  <span className={styles.listItemText}>{crit}</span>
                  <button onClick={() => removeListItem('exclusionCriteria', i)} className={styles.listItemRemove}>✕</button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newExclusion}
                  onChange={(e) => setNewExclusion(e.target.value)}
                  placeholder="e.g., Valvular AF, missing key variables"
                  className={styles.formInput}
                  onKeyDown={(e) => e.key === 'Enter' && addListItem('exclusionCriteria', newExclusion, setNewExclusion)}
                />
                <button onClick={() => addListItem('exclusionCriteria', newExclusion, setNewExclusion)} className={`${styles.navButton} ${styles.navButtonSecondary}`}>Add</button>
              </div>
            </div>
          </>
        );

      case 'outcomes':
        return (
          <>
            <h2 className={styles.stepTitle}>Outcome Definitions</h2>
            <p className={styles.stepDescription}>
              Define the outcomes you will measure based on {systemCard.name} predictions.
            </p>

            <div className="space-y-4">
              {systemCard.outputs.map((output) => (
                <div key={output.name} className="p-4 border border-gray-200 rounded-lg">
                  <h3 className="font-medium text-gray-900">{output.name}</h3>
                  <p className="text-sm text-gray-600">{output.description}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">Outcome Type</label>
                      <select className={styles.formInput}>
                        <option>Binary (yes/no)</option>
                        <option>Time-to-event</option>
                        <option>Continuous</option>
                        <option>Ordinal</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Time Horizon</label>
                      <input
                        type="text"
                        placeholder="e.g., 1 year, 30 days"
                        className={styles.formInput}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        );

      case 'analysis':
        return (
          <>
            <h2 className={styles.stepTitle}>Analysis Plan</h2>
            <p className={styles.stepDescription}>
              Define the statistical methods for validating {systemCard.name}.
            </p>

            <div className="space-y-4">
              {/* Discrimination */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-medium text-blue-900">Discrimination</h3>
                <p className="text-sm text-blue-700 mb-2">
                  How well does the model separate patients with and without the outcome?
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="rounded" />
                    <span className="text-sm">C-statistic / AUC-ROC</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    <span className="text-sm">Sensitivity/Specificity at key thresholds</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    <span className="text-sm">Net Reclassification Improvement (NRI)</span>
                  </label>
                </div>
              </div>

              {/* Calibration */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-medium text-green-900">Calibration</h3>
                <p className="text-sm text-green-700 mb-2">
                  How well do predicted probabilities match observed frequencies?
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="rounded" />
                    <span className="text-sm">Calibration plot (predicted vs. observed)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="rounded" />
                    <span className="text-sm">Calibration slope and intercept</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    <span className="text-sm">Hosmer-Lemeshow test</span>
                  </label>
                </div>
              </div>

              {/* Sample Size */}
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <h3 className="font-medium text-purple-900">Sample Size Considerations</h3>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="text-xs text-gray-500">Expected events</label>
                    <input type="number" placeholder="e.g., 100" className={styles.formInput} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Events per variable (EPV)</label>
                    <input type="number" placeholder="e.g., 10" className={styles.formInput} />
                  </div>
                </div>
              </div>
            </div>
          </>
        );

      case 'review':
        return (
          <>
            <h2 className={styles.stepTitle}>Review & Export</h2>
            <p className={styles.stepDescription}>
              Review your validation study plan before exporting.
            </p>

            <div className={styles.reviewSection}>
              <h3 className={styles.reviewTitle}>Study Overview</h3>
              <div className={styles.reviewContent}>
                <p><strong>System:</strong> {systemCard.name}</p>
                <p><strong>Intent:</strong> {STUDY_INTENTS.find(i => i.value === blueprint.studyIntent)?.label}</p>
              </div>
            </div>

            {blueprint.researchAims && blueprint.researchAims.length > 0 && (
              <div className={styles.reviewSection}>
                <h3 className={styles.reviewTitle}>Research Aims</h3>
                <ul className={styles.reviewList}>
                  {blueprint.researchAims.map((aim, i) => (
                    <li key={i}>{aim}</li>
                  ))}
                </ul>
              </div>
            )}

            {blueprint.hypotheses && blueprint.hypotheses.length > 0 && (
              <div className={styles.reviewSection}>
                <h3 className={styles.reviewTitle}>Hypotheses</h3>
                <ul className={styles.reviewList}>
                  {blueprint.hypotheses.map((hyp, i) => (
                    <li key={i}>{hyp}</li>
                  ))}
                </ul>
              </div>
            )}

            {blueprint.inclusionCriteria && blueprint.inclusionCriteria.length > 0 && (
              <div className={styles.reviewSection}>
                <h3 className={styles.reviewTitle}>Inclusion Criteria</h3>
                <ul className={styles.reviewList}>
                  {blueprint.inclusionCriteria.map((crit, i) => (
                    <li key={i}>{crit}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => onExport?.(blueprint as ValidationBlueprint)}
              className={`${styles.navButton} ${styles.navButtonPrimary} w-full mt-4`}
            >
              Export Study Protocol
            </button>
          </>
        );
    }
  };

  return (
    <div className={`${styles.container} ${className}`}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.headerTitle}>Validation Study Planner</h1>
        <p className={styles.headerSubtitle}>
          Design a validation study for {systemCard.name}
        </p>
      </div>

      {/* Progress */}
      <div className={styles.progress}>
        {STEPS.map((step, i) => (
          <React.Fragment key={step.key}>
            <div className={styles.progressStep}>
              <button
                onClick={() => setCurrentStep(step.key)}
                className={`${styles.progressDot} ${
                  i < currentStepIndex
                    ? styles.progressDotComplete
                    : i === currentStepIndex
                    ? styles.progressDotActive
                    : styles.progressDotPending
                }`}
              >
                {i < currentStepIndex ? '✓' : i + 1}
              </button>
              <span className={styles.progressLabel}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`${styles.progressLine} ${
                  i < currentStepIndex ? styles.progressLineComplete : ''
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Content */}
      <div className={styles.content}>{renderStepContent()}</div>

      {/* Navigation */}
      <div className={styles.navigation}>
        <button
          onClick={goPrev}
          disabled={currentStepIndex === 0}
          className={`${styles.navButton} ${styles.navButtonSecondary}`}
        >
          ← Previous
        </button>
        <button
          onClick={goNext}
          disabled={currentStepIndex === STEPS.length - 1}
          className={`${styles.navButton} ${styles.navButtonPrimary}`}
        >
          Next →
        </button>
      </div>
    </div>
  );
};

export default ValidationPlanner;
