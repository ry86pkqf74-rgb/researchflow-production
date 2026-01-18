import type { IMRaDSection } from '../types/imrad.types';

export interface ValidationResult {
  valid: boolean;
  errors: { field: string; message: string; code: string }[];
  warnings: { field: string; message: string; suggestion?: string }[];
}

export class DataFormatValidator {
  validateForSection(data: unknown, section: IMRaDSection): ValidationResult {
    if (data === null || data === undefined) {
      return {
        valid: false,
        errors: [{ field: 'data', message: 'Data cannot be null', code: 'NULL_DATA' }],
        warnings: []
      };
    }
    switch (section) {
      case 'results':
        return this.validateForResults(data);
      case 'abstract':
        return this.validateForAbstract(data);
      default:
        return { valid: true, errors: [], warnings: [] };
    }
  }

  validateNumericPrecision(
    value: number,
    context: 'p_value' | 'percentage' | 'mean' | 'count'
  ): { valid: boolean; formatted: string; warning?: string } {
    switch (context) {
      case 'p_value':
        return value < 0.001
          ? { valid: true, formatted: '<0.001' }
          : { valid: true, formatted: value.toFixed(3) };
      case 'percentage':
        return {
          valid: value >= 0 && value <= 100,
          formatted: value.toFixed(1),
          warning: value < 0 || value > 100 ? 'Outside 0-100' : undefined
        };
      case 'count':
        return {
          valid: true,
          formatted: Math.round(value).toString(),
          warning: !Number.isInteger(value) ? 'Rounded' : undefined
        };
      default:
        return { valid: true, formatted: value.toFixed(2) };
    }
  }

  private validateForResults(data: unknown): ValidationResult {
    const warnings: ValidationResult['warnings'] = [];
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      if (!obj.sampleSize && !obj.n) {
        warnings.push({ field: 'sampleSize', message: 'Sample size not specified' });
      }
    }
    return { valid: true, errors: [], warnings };
  }

  private validateForAbstract(data: unknown): ValidationResult {
    const warnings: ValidationResult['warnings'] = [];
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      for (const field of ['methods', 'results', 'conclusions']) {
        if (!obj[field]) {
          warnings.push({ field, message: `Missing ${field} section` });
        }
      }
    }
    return { valid: true, errors: [], warnings };
  }
}

export const dataFormatValidator = new DataFormatValidator();
