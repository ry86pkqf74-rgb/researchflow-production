/**
 * Tests for Scientific Notation Service
 * Task 149 - Scientific notation localization
 */

import { describe, it, expect } from 'vitest';
import {
  formatScientific,
  formatWithUnit,
  convertUnit,
  parseScientific,
  toSIPrefix,
  getSupportedUnits,
  getFormattingOptions,
} from '../scientificNotationService';

describe('ScientificNotationService', () => {
  describe('formatScientific', () => {
    it('should format in scientific notation', () => {
      const result = formatScientific(1234567, { style: 'SCIENTIFIC' });
      expect(result).toMatch(/1\.23.*10.*6/);
    });

    it('should format in engineering notation', () => {
      const result = formatScientific(1234567, { style: 'ENGINEERING' });
      // Engineering notation uses powers of 3
      expect(result).toMatch(/1\.23.*10.*6/);
    });

    it('should format in E notation', () => {
      const result = formatScientific(1234567, { style: 'E_NOTATION' });
      expect(result).toMatch(/1\.23.*[eE].*6/);
    });

    it('should format in plain notation', () => {
      const result = formatScientific(1234.56, { style: 'PLAIN' });
      expect(result).toBe('1234.56');
    });

    it('should use SI prefixes', () => {
      const result = formatScientific(1500, { style: 'SI_PREFIX' });
      expect(result).toMatch(/1\.5.*k/);
    });

    it('should format for LaTeX', () => {
      const result = formatScientific(1234567, { style: 'LATEX' });
      expect(result).toContain('\\times');
      expect(result).toContain('^{6}');
    });

    it('should respect precision', () => {
      const result = formatScientific(1.23456789, { style: 'PLAIN', precision: 2 });
      expect(result).toBe('1.23');
    });

    it('should add thousands separator', () => {
      const result = formatScientific(1234567, {
        style: 'PLAIN',
        thousandsSeparator: ',',
      });
      expect(result).toBe('1,234,567');
    });

    it('should use custom decimal separator', () => {
      const result = formatScientific(1234.56, {
        style: 'PLAIN',
        decimalSeparator: ',',
      });
      expect(result).toBe('1234,56');
    });

    it('should add sign prefix for positive numbers', () => {
      const result = formatScientific(42, { style: 'PLAIN', showPositiveSign: true });
      expect(result).toBe('+42');
    });

    it('should handle negative numbers', () => {
      const result = formatScientific(-42, { style: 'PLAIN' });
      expect(result).toBe('-42');
    });

    it('should handle zero', () => {
      const result = formatScientific(0, { style: 'SCIENTIFIC' });
      expect(result).toContain('0');
    });

    it('should handle very small numbers', () => {
      const result = formatScientific(0.000001234, { style: 'SCIENTIFIC' });
      expect(result).toMatch(/1\.23.*10.*-6/);
    });
  });

  describe('formatWithUnit', () => {
    it('should format value with unit', () => {
      const result = formatWithUnit(1500, 'm');
      expect(result).toContain('1500');
      expect(result).toContain('m');
    });

    it('should apply SI prefix to unit', () => {
      const result = formatWithUnit(1500, 'm', { style: 'SI_PREFIX' });
      expect(result).toMatch(/1\.5.*km/);
    });

    it('should format with complex units', () => {
      const result = formatWithUnit(9.8, 'm/s²', { style: 'PLAIN', precision: 1 });
      expect(result).toBe('9.8 m/s²');
    });
  });

  describe('convertUnit', () => {
    it('should convert between compatible units', () => {
      const result = convertUnit(1000, 'm', 'km');
      expect(result).toBe(1);
    });

    it('should convert temperature (Celsius to Fahrenheit)', () => {
      const result = convertUnit(100, '°C', '°F');
      expect(result).toBe(212);
    });

    it('should convert temperature (Fahrenheit to Celsius)', () => {
      const result = convertUnit(32, '°F', '°C');
      expect(result).toBe(0);
    });

    it('should throw error for incompatible units', () => {
      expect(() => convertUnit(1, 'm', 'kg')).toThrow('Cannot convert');
    });

    it('should handle same unit conversion', () => {
      const result = convertUnit(42, 'm', 'm');
      expect(result).toBe(42);
    });
  });

  describe('parseScientific', () => {
    it('should parse scientific notation', () => {
      const result = parseScientific('1.23e6');
      expect(result).toBe(1230000);
    });

    it('should parse with × symbol', () => {
      const result = parseScientific('1.23 × 10^6');
      expect(result).toBeCloseTo(1230000, 0);
    });

    it('should parse plain numbers', () => {
      const result = parseScientific('42');
      expect(result).toBe(42);
    });

    it('should parse negative exponents', () => {
      const result = parseScientific('1.23e-3');
      expect(result).toBeCloseTo(0.00123, 6);
    });

    it('should handle thousands separators', () => {
      const result = parseScientific('1,234,567');
      expect(result).toBe(1234567);
    });
  });

  describe('toSIPrefix', () => {
    it('should convert to kilo', () => {
      const result = toSIPrefix(1500);
      expect(result.value).toBe(1.5);
      expect(result.prefix).toBe('k');
      expect(result.multiplier).toBe(1000);
    });

    it('should convert to mega', () => {
      const result = toSIPrefix(1500000);
      expect(result.value).toBe(1.5);
      expect(result.prefix).toBe('M');
    });

    it('should convert to milli', () => {
      const result = toSIPrefix(0.0015);
      expect(result.value).toBe(1.5);
      expect(result.prefix).toBe('m');
    });

    it('should handle values near 1', () => {
      const result = toSIPrefix(1);
      expect(result.value).toBe(1);
      expect(result.prefix).toBe('');
    });
  });

  describe('getSupportedUnits', () => {
    it('should return list of supported units', () => {
      const units = getSupportedUnits();
      expect(units.length).toBeGreaterThan(0);
      expect(units).toContain('m');
      expect(units).toContain('kg');
      expect(units).toContain('s');
    });
  });

  describe('getFormattingOptions', () => {
    it('should return default options', () => {
      const options = getFormattingOptions();
      expect(options).toHaveProperty('style');
      expect(options).toHaveProperty('precision');
      expect(options).toHaveProperty('decimalSeparator');
    });
  });
});
