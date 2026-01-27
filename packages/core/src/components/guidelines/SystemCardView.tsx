/**
 * SystemCardView Component
 *
 * Detailed view of a clinical scoring system or guideline.
 * Displays inputs, outputs, interpretation, evidence, and limitations.
 *
 * Features:
 * - Interactive input form for score calculation
 * - Interpretation guide with clinical actions
 * - Evidence statements with citations
 * - Version history and comparison
 */

import React, { useState, useCallback } from 'react';
import type {
  SystemCard,
  RuleSpec,
  EvidenceStatement,
  InputVariable,
  CalculateScoreResponse,
} from '../../api/guidelines-api';

// =============================================================================
// Types
// =============================================================================

export interface SystemCardViewProps {
  /** The system card to display */
  systemCard: SystemCard;
  /** Associated rule specifications */
  ruleSpecs?: RuleSpec[];
  /** Evidence statements */
  evidence?: EvidenceStatement[];
  /** Callback for score calculation */
  onCalculate?: (inputs: Record<string, unknown>) => Promise<CalculateScoreResponse>;
  /** Show/hide calculation form */
  showCalculator?: boolean;
  /** Custom class name */
  className?: string;
}

export interface CalculatorFormProps {
  inputs: InputVariable[];
  onSubmit: (values: Record<string, unknown>) => void;
  loading?: boolean;
}

// =============================================================================
// Styles
// =============================================================================

const styles = {
  container: 'max-w-4xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden',
  header: 'bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6',
  headerTop: 'flex items-start justify-between',
  title: 'text-2xl font-bold mb-2',
  badges: 'flex gap-2 flex-wrap',
  badge: 'px-3 py-1 text-xs font-medium rounded-full bg-white/20',
  badgeVerified: 'bg-green-500/30 text-green-100',
  meta: 'mt-4 text-blue-100 text-sm',
  content: 'p-6',
  section: 'mb-8',
  sectionTitle: 'text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2',
  sectionIcon: 'w-5 h-5 text-blue-600',
  // Inputs/Outputs
  variableGrid: 'grid grid-cols-1 md:grid-cols-2 gap-4',
  variableCard: 'border border-gray-200 rounded-lg p-4',
  variableName: 'font-medium text-gray-900',
  variableType: 'text-xs text-gray-500 uppercase tracking-wide',
  variableDesc: 'text-sm text-gray-600 mt-1',
  variableValues: 'text-xs text-gray-500 mt-2',
  // Interpretation
  interpretationTable: 'w-full border-collapse',
  tableHeader: 'bg-gray-50 text-left text-sm font-medium text-gray-700',
  tableCell: 'border-b border-gray-200 px-4 py-3 text-sm',
  tableCellRange: 'font-mono font-medium',
  // Evidence
  evidenceCard: 'bg-gray-50 rounded-lg p-4 mb-3',
  evidenceText: 'text-gray-800 mb-2',
  evidenceMeta: 'flex items-center gap-4 text-xs text-gray-500',
  evidenceBadge: 'px-2 py-0.5 rounded text-xs font-medium',
  evidenceStrong: 'bg-green-100 text-green-800',
  evidenceModerate: 'bg-yellow-100 text-yellow-800',
  evidenceWeak: 'bg-red-100 text-red-800',
  // Limitations
  limitationsList: 'space-y-2',
  limitationItem: 'flex items-start gap-2 text-sm text-gray-600',
  limitationIcon: 'w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0',
  // Calculator
  calculator: 'bg-blue-50 rounded-lg p-6 mt-6',
  calculatorTitle: 'text-lg font-semibold text-gray-900 mb-4',
  form: 'space-y-4',
  formGroup: 'space-y-2',
  formLabel: 'block text-sm font-medium text-gray-700',
  formInput: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
  formSelect: 'w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500',
  formCheckbox: 'flex items-center gap-2',
  formButton: 'w-full py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50',
  // Result
  result: 'mt-6 p-6 bg-white border-2 border-blue-500 rounded-lg',
  resultTitle: 'text-lg font-bold text-gray-900',
  resultScore: 'text-4xl font-bold text-blue-600 my-2',
  resultInterpretation: 'text-gray-700',
};

// =============================================================================
// Calculator Form Component
// =============================================================================

const CalculatorForm: React.FC<CalculatorFormProps> = ({ inputs, onSubmit, loading }) => {
  const [values, setValues] = useState<Record<string, unknown>>({});

  const handleChange = useCallback((name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(values);
    },
    [values, onSubmit]
  );

  const renderInput = (input: InputVariable) => {
    const id = `input-${input.name}`;

    switch (input.type) {
      case 'boolean':
        return (
          <label className={styles.formCheckbox}>
            <input
              type="checkbox"
              id={id}
              checked={Boolean(values[input.name])}
              onChange={(e) => handleChange(input.name, e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm text-gray-700">{input.description || input.name}</span>
          </label>
        );

      case 'categorical':
        return (
          <select
            id={id}
            value={String(values[input.name] || '')}
            onChange={(e) => handleChange(input.name, e.target.value)}
            className={styles.formSelect}
            required={input.required}
          >
            <option value="">Select {input.name}</option>
            {Array.isArray(input.validValues) &&
              input.validValues.map((v) => (
                <option key={v} value={v}>
                  {String(v).replace(/_/g, ' ')}
                </option>
              ))}
          </select>
        );

      case 'numeric':
        const range = input.validValues as { min?: number; max?: number } | undefined;
        return (
          <input
            type="number"
            id={id}
            value={values[input.name] !== undefined ? String(values[input.name]) : ''}
            onChange={(e) => handleChange(input.name, e.target.value ? parseFloat(e.target.value) : undefined)}
            min={range?.min}
            max={range?.max}
            step="any"
            className={styles.formInput}
            required={input.required}
            placeholder={input.unit ? `Enter value (${input.unit})` : 'Enter value'}
          />
        );

      default:
        return (
          <input
            type="text"
            id={id}
            value={String(values[input.name] || '')}
            onChange={(e) => handleChange(input.name, e.target.value)}
            className={styles.formInput}
            required={input.required}
          />
        );
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {inputs.map((input) => (
        <div key={input.name} className={styles.formGroup}>
          {input.type !== 'boolean' && (
            <label htmlFor={`input-${input.name}`} className={styles.formLabel}>
              {input.name.replace(/_/g, ' ')}
              {input.required && <span className="text-red-500 ml-1">*</span>}
              {input.unit && <span className="text-gray-400 ml-1">({input.unit})</span>}
            </label>
          )}
          {renderInput(input)}
          {input.description && input.type !== 'boolean' && (
            <p className="text-xs text-gray-500">{input.description}</p>
          )}
        </div>
      ))}
      <button type="submit" disabled={loading} className={styles.formButton}>
        {loading ? 'Calculating...' : 'Calculate Score'}
      </button>
    </form>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const SystemCardView: React.FC<SystemCardViewProps> = ({
  systemCard,
  ruleSpecs = [],
  evidence = [],
  onCalculate,
  showCalculator = true,
  className = '',
}) => {
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<CalculateScoreResponse | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);

  const handleCalculate = useCallback(
    async (inputs: Record<string, unknown>) => {
      if (!onCalculate) return;

      setCalculating(true);
      setCalcError(null);

      try {
        const response = await onCalculate(inputs);
        setResult(response);
      } catch (err) {
        setCalcError(err instanceof Error ? err.message : 'Calculation failed');
      } finally {
        setCalculating(false);
      }
    },
    [onCalculate]
  );

  const getEvidenceStrengthClass = (strength?: string) => {
    switch (strength) {
      case 'strong':
        return styles.evidenceStrong;
      case 'moderate':
        return styles.evidenceModerate;
      case 'weak':
        return styles.evidenceWeak;
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={`${styles.container} ${className}`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <h1 className={styles.title}>{systemCard.name}</h1>
            <div className={styles.badges}>
              <span className={styles.badge}>
                {systemCard.type.replace(/_/g, ' ')}
              </span>
              {systemCard.specialty && (
                <span className={styles.badge}>{systemCard.specialty}</span>
              )}
              {systemCard.verified && (
                <span className={`${styles.badge} ${styles.badgeVerified}`}>
                  ✓ Verified
                </span>
              )}
            </div>
          </div>
        </div>
        {systemCard.population && (
          <p className={styles.meta}>
            <strong>Population:</strong> {systemCard.population}
          </p>
        )}
        {systemCard.careSetting && (
          <p className={styles.meta}>
            <strong>Care Setting:</strong> {systemCard.careSetting}
          </p>
        )}
      </div>

      <div className={styles.content}>
        {/* Inputs Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <svg className={styles.sectionIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Input Variables
          </h2>
          <div className={styles.variableGrid}>
            {systemCard.inputs.map((input) => (
              <div key={input.name} className={styles.variableCard}>
                <div className="flex justify-between items-start">
                  <span className={styles.variableName}>
                    {input.name.replace(/_/g, ' ')}
                  </span>
                  <span className={styles.variableType}>{input.type}</span>
                </div>
                {input.description && (
                  <p className={styles.variableDesc}>{input.description}</p>
                )}
                {input.validValues && (
                  <p className={styles.variableValues}>
                    {Array.isArray(input.validValues)
                      ? `Options: ${input.validValues.join(', ')}`
                      : `Range: ${input.validValues.min ?? '?'} - ${input.validValues.max ?? '?'}`}
                    {input.unit && ` ${input.unit}`}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Outputs Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <svg className={styles.sectionIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Outputs
          </h2>
          <div className={styles.variableGrid}>
            {systemCard.outputs.map((output) => (
              <div key={output.name} className={styles.variableCard}>
                <div className="flex justify-between items-start">
                  <span className={styles.variableName}>{output.name}</span>
                  <span className={styles.variableType}>{output.type}</span>
                </div>
                {output.description && (
                  <p className={styles.variableDesc}>{output.description}</p>
                )}
                {output.range && (
                  <p className={styles.variableValues}>Range: {output.range}</p>
                )}
                {output.labels && (
                  <p className={styles.variableValues}>
                    Labels: {output.labels.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Interpretation Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <svg className={styles.sectionIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Interpretation Guide
          </h2>
          <table className={styles.interpretationTable}>
            <thead>
              <tr>
                <th className={`${styles.tableHeader} ${styles.tableCell}`}>Range</th>
                <th className={`${styles.tableHeader} ${styles.tableCell}`}>Meaning</th>
                <th className={`${styles.tableHeader} ${styles.tableCell}`}>Clinical Action</th>
              </tr>
            </thead>
            <tbody>
              {systemCard.interpretation.map((interp, i) => (
                <tr key={i}>
                  <td className={`${styles.tableCell} ${styles.tableCellRange}`}>
                    {interp.range}
                  </td>
                  <td className={styles.tableCell}>{interp.meaning}</td>
                  <td className={styles.tableCell}>
                    {interp.clinicalAction || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Evidence Section */}
        {evidence.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <svg className={styles.sectionIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Evidence
            </h2>
            {evidence.map((ev) => (
              <div key={ev.id} className={styles.evidenceCard}>
                <p className={styles.evidenceText}>{ev.statementText}</p>
                <div className={styles.evidenceMeta}>
                  {ev.strength && (
                    <span className={`${styles.evidenceBadge} ${getEvidenceStrengthClass(ev.strength)}`}>
                      {ev.strength}
                    </span>
                  )}
                  {ev.quality && (
                    <span className={styles.evidenceBadge}>
                      Quality: {ev.quality}
                    </span>
                  )}
                  {ev.citationRef && (
                    <span className="text-gray-600">{ev.citationRef}</span>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Limitations Section */}
        {systemCard.limitations && systemCard.limitations.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <svg className={styles.sectionIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Limitations
            </h2>
            <ul className={styles.limitationsList}>
              {systemCard.limitations.map((limitation, i) => (
                <li key={i} className={styles.limitationItem}>
                  <svg className={styles.limitationIcon} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {limitation}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Calculator Section */}
        {showCalculator && onCalculate && systemCard.inputs.length > 0 && (
          <div className={styles.calculator}>
            <h2 className={styles.calculatorTitle}>Calculate {systemCard.name}</h2>
            <CalculatorForm
              inputs={systemCard.inputs}
              onSubmit={handleCalculate}
              loading={calculating}
            />

            {calcError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                {calcError}
              </div>
            )}

            {result && (
              <div className={styles.result}>
                <h3 className={styles.resultTitle}>Result</h3>
                <div className={styles.resultScore}>
                  {Object.entries(result.result.outputs).map(([key, value]) => (
                    <div key={key}>
                      <span className="text-sm text-gray-500">{key}: </span>
                      <span>{String(value)}</span>
                    </div>
                  ))}
                </div>
                {result.result.interpretation && (
                  <p className={styles.resultInterpretation}>
                    {result.result.interpretation}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemCardView;
