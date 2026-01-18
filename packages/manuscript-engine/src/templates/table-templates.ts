/**
 * Table Templates
 * Pre-defined templates for common clinical tables
 */

import type { TableTemplate } from '../types';

/**
 * Demographics table template (Table 1)
 */
export const DEMOGRAPHICS_TABLE: TableTemplate = {
  name: 'Demographics and Baseline Characteristics',
  columns: [
    { name: 'Characteristic', type: 'string' },
    { name: 'Value', type: 'string' },
  ],
  rows: [
    { Characteristic: 'Age, years, mean ± SD', Value: '' },
    { Characteristic: 'Female sex, n (%)', Value: '' },
    { Characteristic: 'BMI, kg/m², mean ± SD', Value: '' },
    { Characteristic: 'Race/Ethnicity, n (%)' Value: '' },
    { Characteristic: '  White', Value: '' },
    { Characteristic: '  Black or African American', Value: '' },
    { Characteristic: '  Hispanic or Latino', Value: '' },
    { Characteristic: '  Asian', Value: '' },
    { Characteristic: '  Other', Value: '' },
  ],
  caption: 'Table 1. Demographics and Baseline Characteristics of Study Participants',
  notes: ['Data are presented as n (%) or mean ± SD', 'BMI indicates body mass index; SD, standard deviation'],
};

/**
 * Outcomes table template
 */
export const OUTCOMES_TABLE: TableTemplate = {
  name: 'Primary and Secondary Outcomes',
  columns: [
    { name: 'Outcome', type: 'string' },
    { name: 'Intervention', type: 'string' },
    { name: 'Control', type: 'string' },
    { name: 'Difference', type: 'string' },
    { name: 'P Value', type: 'string' },
  ],
  rows: [
    { Outcome: 'Primary outcome', Intervention: '', Control: '', Difference: '', 'P Value': '' },
    { Outcome: 'Secondary outcome 1', Intervention: '', Control: '', Difference: '', 'P Value': '' },
    { Outcome: 'Secondary outcome 2', Intervention: '', Control: '', Difference: '', 'P Value': '' },
  ],
  caption: 'Table 2. Primary and Secondary Outcomes',
  notes: ['Data are presented as n (%) or mean (95% CI)'],
};

/**
 * Comparison table template
 */
export const COMPARISON_TABLE: TableTemplate = {
  name: 'Comparison Between Groups',
  columns: [
    { name: 'Variable', type: 'string' },
    { name: 'Group A (n=X)', type: 'string' },
    { name: 'Group B (n=Y)', type: 'string' },
    { name: 'P Value', type: 'string' },
  ],
  rows: [
    { Variable: 'Continuous variable 1', 'Group A (n=X)': '', 'Group B (n=Y)': '', 'P Value': '' },
    { Variable: 'Categorical variable 1', 'Group A (n=X)': '', 'Group B (n=Y)': '', 'P Value': '' },
  ],
  caption: 'Table 3. Comparison Between Study Groups',
};

/**
 * Regression table template
 */
export const REGRESSION_TABLE: TableTemplate = {
  name: 'Multivariable Regression Analysis',
  columns: [
    { name: 'Variable', type: 'string' },
    { name: 'Coefficient', type: 'string' },
    { name: '95% CI', type: 'string' },
    { name: 'P Value', type: 'string' },
  ],
  rows: [
    { Variable: 'Predictor 1', Coefficient: '', '95% CI': '', 'P Value': '' },
    { Variable: 'Predictor 2', Coefficient: '', '95% CI': '', 'P Value': '' },
    { Variable: 'Predictor 3', Coefficient: '', '95% CI': '', 'P Value': '' },
  ],
  caption: 'Table 4. Multivariable Regression Analysis Results',
  notes: ['CI indicates confidence interval'],
};

/**
 * All available templates
 */
export const TABLE_TEMPLATES = {
  demographics: DEMOGRAPHICS_TABLE,
  outcomes: OUTCOMES_TABLE,
  comparison: COMPARISON_TABLE,
  regression: REGRESSION_TABLE,
} as const;

/**
 * Get template by name
 */
export function getTableTemplate(name: keyof typeof TABLE_TEMPLATES): TableTemplate {
  return TABLE_TEMPLATES[name];
}

/**
 * Create custom table from data
 */
export function createTableFromData(
  name: string,
  data: Array<Record<string, unknown>>,
  caption: string,
  notes?: string[]
): TableTemplate {
  if (data.length === 0) {
    throw new Error('Cannot create table from empty data');
  }

  // Extract columns from first row
  const columns = Object.keys(data[0]).map(key => ({
    name: key,
    type: typeof data[0][key] === 'number' ? 'number' as const : 'string' as const,
  }));

  return {
    name,
    columns,
    rows: data,
    caption,
    notes,
  };
}
