/**
 * Scientific Notation Service
 * Task 149 - Localization for scientific notations
 *
 * Provides:
 * - Scientific number formatting
 * - Unit conversion and display
 * - Locale-aware formatting
 * - SI prefix handling
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// Types & Schemas
// ─────────────────────────────────────────────────────────────

export const NotationStyleSchema = z.enum([
  'SCIENTIFIC',     // 1.23×10⁴
  'ENGINEERING',    // 12.3×10³ (exponent multiple of 3)
  'E_NOTATION',     // 1.23E+04
  'PLAIN',          // 12300
  'SI_PREFIX',      // 12.3k
  'LATEX',          // 1.23 \\times 10^{4}
]);

export const UnitSystemSchema = z.enum([
  'SI',             // International System of Units
  'CGS',            // Centimeter-Gram-Second
  'IMPERIAL',       // Imperial/US customary
  'NATURAL',        // Natural units (physics)
]);

export const FormattingOptionsSchema = z.object({
  style: NotationStyleSchema.default('SCIENTIFIC'),
  significantDigits: z.number().int().min(1).max(15).default(3),
  minExponentForScientific: z.number().default(4),
  locale: z.string().default('en-US'),
  useGrouping: z.boolean().default(true),
  unitSystem: UnitSystemSchema.default('SI'),
  showUncertainty: z.boolean().default(false),
  uncertaintyStyle: z.enum(['PLUS_MINUS', 'PARENTHESES', 'SEPARATE']).default('PLUS_MINUS'),
});

export type NotationStyle = z.infer<typeof NotationStyleSchema>;
export type UnitSystem = z.infer<typeof UnitSystemSchema>;
export type FormattingOptions = z.infer<typeof FormattingOptionsSchema>;

// ─────────────────────────────────────────────────────────────
// SI Prefixes
// ─────────────────────────────────────────────────────────────

const SI_PREFIXES: Array<{ exponent: number; prefix: string; symbol: string }> = [
  { exponent: 24, prefix: 'yotta', symbol: 'Y' },
  { exponent: 21, prefix: 'zetta', symbol: 'Z' },
  { exponent: 18, prefix: 'exa', symbol: 'E' },
  { exponent: 15, prefix: 'peta', symbol: 'P' },
  { exponent: 12, prefix: 'tera', symbol: 'T' },
  { exponent: 9, prefix: 'giga', symbol: 'G' },
  { exponent: 6, prefix: 'mega', symbol: 'M' },
  { exponent: 3, prefix: 'kilo', symbol: 'k' },
  { exponent: 2, prefix: 'hecto', symbol: 'h' },
  { exponent: 1, prefix: 'deca', symbol: 'da' },
  { exponent: 0, prefix: '', symbol: '' },
  { exponent: -1, prefix: 'deci', symbol: 'd' },
  { exponent: -2, prefix: 'centi', symbol: 'c' },
  { exponent: -3, prefix: 'milli', symbol: 'm' },
  { exponent: -6, prefix: 'micro', symbol: 'μ' },
  { exponent: -9, prefix: 'nano', symbol: 'n' },
  { exponent: -12, prefix: 'pico', symbol: 'p' },
  { exponent: -15, prefix: 'femto', symbol: 'f' },
  { exponent: -18, prefix: 'atto', symbol: 'a' },
  { exponent: -21, prefix: 'zepto', symbol: 'z' },
  { exponent: -24, prefix: 'yocto', symbol: 'y' },
];

// ─────────────────────────────────────────────────────────────
// Unicode Superscripts
// ─────────────────────────────────────────────────────────────

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻',
};

function toSuperscript(num: number): string {
  const str = String(num);
  return str.split('').map(c => SUPERSCRIPT_DIGITS[c] ?? c).join('');
}

// ─────────────────────────────────────────────────────────────
// Formatting Functions
// ─────────────────────────────────────────────────────────────

export function formatScientific(
  value: number,
  options: Partial<FormattingOptions> = {}
): string {
  const opts = FormattingOptionsSchema.parse(options);

  // Handle special cases
  if (!Number.isFinite(value)) {
    if (Number.isNaN(value)) return 'NaN';
    return value > 0 ? '∞' : '-∞';
  }

  if (value === 0) return '0';

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const exponent = Math.floor(Math.log10(absValue));

  // Decide whether to use scientific notation
  const useScientific = Math.abs(exponent) >= opts.minExponentForScientific;

  switch (opts.style) {
    case 'PLAIN':
      return formatPlain(value, opts);

    case 'E_NOTATION':
      if (!useScientific) return formatPlain(value, opts);
      return formatENotation(value, opts);

    case 'ENGINEERING':
      if (!useScientific) return formatPlain(value, opts);
      return formatEngineering(value, opts);

    case 'SI_PREFIX':
      return formatSIPrefix(value, opts);

    case 'LATEX':
      if (!useScientific) return formatPlain(value, opts);
      return formatLatex(value, opts);

    case 'SCIENTIFIC':
    default:
      if (!useScientific) return formatPlain(value, opts);
      return formatScientificNotation(value, opts);
  }
}

function formatPlain(value: number, opts: FormattingOptions): string {
  return new Intl.NumberFormat(opts.locale, {
    maximumSignificantDigits: opts.significantDigits,
    useGrouping: opts.useGrouping,
  }).format(value);
}

function formatScientificNotation(value: number, opts: FormattingOptions): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const exponent = Math.floor(Math.log10(absValue));
  const mantissa = absValue / Math.pow(10, exponent);

  const mantissaStr = new Intl.NumberFormat(opts.locale, {
    minimumFractionDigits: opts.significantDigits - 1,
    maximumFractionDigits: opts.significantDigits - 1,
  }).format(mantissa);

  return `${sign}${mantissaStr}×10${toSuperscript(exponent)}`;
}

function formatENotation(value: number, opts: FormattingOptions): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const exponent = Math.floor(Math.log10(absValue));
  const mantissa = absValue / Math.pow(10, exponent);

  const mantissaStr = mantissa.toFixed(opts.significantDigits - 1);
  const expSign = exponent >= 0 ? '+' : '';

  return `${sign}${mantissaStr}E${expSign}${exponent}`;
}

function formatEngineering(value: number, opts: FormattingOptions): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const rawExponent = Math.floor(Math.log10(absValue));

  // Round exponent to nearest multiple of 3
  const exponent = Math.floor(rawExponent / 3) * 3;
  const mantissa = absValue / Math.pow(10, exponent);

  const mantissaStr = new Intl.NumberFormat(opts.locale, {
    minimumFractionDigits: 0,
    maximumSignificantDigits: opts.significantDigits,
  }).format(mantissa);

  return `${sign}${mantissaStr}×10${toSuperscript(exponent)}`;
}

function formatSIPrefix(value: number, opts: FormattingOptions): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue === 0) return '0';

  const exponent = Math.floor(Math.log10(absValue));

  // Find best SI prefix
  let bestPrefix = SI_PREFIXES.find(p => p.exponent === 0)!;
  for (const prefix of SI_PREFIXES) {
    if (exponent >= prefix.exponent) {
      bestPrefix = prefix;
      break;
    }
  }

  const scaledValue = absValue / Math.pow(10, bestPrefix.exponent);

  const valueStr = new Intl.NumberFormat(opts.locale, {
    maximumSignificantDigits: opts.significantDigits,
  }).format(scaledValue);

  return `${sign}${valueStr}${bestPrefix.symbol}`;
}

function formatLatex(value: number, opts: FormattingOptions): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const exponent = Math.floor(Math.log10(absValue));
  const mantissa = absValue / Math.pow(10, exponent);

  const mantissaStr = mantissa.toFixed(opts.significantDigits - 1);

  return `${sign}${mantissaStr} \\times 10^{${exponent}}`;
}

// ─────────────────────────────────────────────────────────────
// Uncertainty Formatting
// ─────────────────────────────────────────────────────────────

export function formatWithUncertainty(
  value: number,
  uncertainty: number,
  options: Partial<FormattingOptions> = {}
): string {
  const opts = FormattingOptionsSchema.parse({
    ...options,
    showUncertainty: true,
  });

  const valueStr = formatScientific(value, opts);

  switch (opts.uncertaintyStyle) {
    case 'PARENTHESES': {
      // Express uncertainty in last digits: 1.234(5)
      const uncDigits = Math.round(uncertainty * Math.pow(10, opts.significantDigits - 1));
      return `${valueStr}(${uncDigits})`;
    }
    case 'SEPARATE':
      return `${valueStr}, σ = ${formatScientific(uncertainty, opts)}`;
    case 'PLUS_MINUS':
    default:
      return `${valueStr} ± ${formatScientific(uncertainty, opts)}`;
  }
}

// ─────────────────────────────────────────────────────────────
// Unit Formatting
// ─────────────────────────────────────────────────────────────

export interface UnitDefinition {
  symbol: string;
  name: string;
  dimension: string;
  siConversion?: number; // Multiply by this to get SI
}

const COMMON_UNITS: Record<string, UnitDefinition> = {
  // Length
  'm': { symbol: 'm', name: 'meter', dimension: 'L', siConversion: 1 },
  'cm': { symbol: 'cm', name: 'centimeter', dimension: 'L', siConversion: 0.01 },
  'mm': { symbol: 'mm', name: 'millimeter', dimension: 'L', siConversion: 0.001 },
  'km': { symbol: 'km', name: 'kilometer', dimension: 'L', siConversion: 1000 },
  'in': { symbol: 'in', name: 'inch', dimension: 'L', siConversion: 0.0254 },
  'ft': { symbol: 'ft', name: 'foot', dimension: 'L', siConversion: 0.3048 },

  // Mass
  'kg': { symbol: 'kg', name: 'kilogram', dimension: 'M', siConversion: 1 },
  'g': { symbol: 'g', name: 'gram', dimension: 'M', siConversion: 0.001 },
  'mg': { symbol: 'mg', name: 'milligram', dimension: 'M', siConversion: 1e-6 },
  'lb': { symbol: 'lb', name: 'pound', dimension: 'M', siConversion: 0.453592 },

  // Time
  's': { symbol: 's', name: 'second', dimension: 'T', siConversion: 1 },
  'ms': { symbol: 'ms', name: 'millisecond', dimension: 'T', siConversion: 0.001 },
  'min': { symbol: 'min', name: 'minute', dimension: 'T', siConversion: 60 },
  'h': { symbol: 'h', name: 'hour', dimension: 'T', siConversion: 3600 },

  // Concentration
  'mol/L': { symbol: 'mol/L', name: 'molar', dimension: 'N/L³', siConversion: 1000 },
  'mM': { symbol: 'mM', name: 'millimolar', dimension: 'N/L³', siConversion: 1 },
  'μM': { symbol: 'μM', name: 'micromolar', dimension: 'N/L³', siConversion: 0.001 },
  'nM': { symbol: 'nM', name: 'nanomolar', dimension: 'N/L³', siConversion: 1e-6 },

  // Temperature
  'K': { symbol: 'K', name: 'kelvin', dimension: 'Θ', siConversion: 1 },
  '°C': { symbol: '°C', name: 'degree Celsius', dimension: 'Θ' },
  '°F': { symbol: '°F', name: 'degree Fahrenheit', dimension: 'Θ' },
};

export function formatWithUnit(
  value: number,
  unit: string,
  options: Partial<FormattingOptions> = {}
): string {
  const valueStr = formatScientific(value, options);
  const unitDef = COMMON_UNITS[unit];

  if (unitDef) {
    return `${valueStr} ${unitDef.symbol}`;
  }

  return `${valueStr} ${unit}`;
}

export function convertUnit(
  value: number,
  fromUnit: string,
  toUnit: string
): number | undefined {
  const from = COMMON_UNITS[fromUnit];
  const to = COMMON_UNITS[toUnit];

  if (!from || !to) return undefined;
  if (from.dimension !== to.dimension) return undefined;
  if (!from.siConversion || !to.siConversion) return undefined;

  // Convert via SI
  const siValue = value * from.siConversion;
  return siValue / to.siConversion;
}

// ─────────────────────────────────────────────────────────────
// Date Formatting for Scientific Contexts
// ─────────────────────────────────────────────────────────────

export function formatScientificDate(
  date: Date,
  locale: string = 'en-US',
  format: 'SHORT' | 'MEDIUM' | 'LONG' | 'ISO' = 'MEDIUM'
): string {
  switch (format) {
    case 'ISO':
      return date.toISOString().split('T')[0];
    case 'SHORT':
      return new Intl.DateTimeFormat(locale, {
        year: '2-digit',
        month: 'numeric',
        day: 'numeric',
      }).format(date);
    case 'LONG':
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date);
    case 'MEDIUM':
    default:
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(date);
  }
}

// ─────────────────────────────────────────────────────────────
// User Preferences
// ─────────────────────────────────────────────────────────────

export interface NotationPreferences {
  style: NotationStyle;
  significantDigits: number;
  locale: string;
  unitSystem: UnitSystem;
  dateFormat: 'SHORT' | 'MEDIUM' | 'LONG' | 'ISO';
  useThousandsSeparator: boolean;
}

const userPreferences: Map<string, NotationPreferences> = new Map();

export function getUserPreferences(userId: string): NotationPreferences {
  return userPreferences.get(userId) ?? {
    style: 'SCIENTIFIC',
    significantDigits: 3,
    locale: 'en-US',
    unitSystem: 'SI',
    dateFormat: 'ISO',
    useThousandsSeparator: true,
  };
}

export function setUserPreferences(
  userId: string,
  prefs: Partial<NotationPreferences>
): NotationPreferences {
  const current = getUserPreferences(userId);
  const updated = { ...current, ...prefs };
  userPreferences.set(userId, updated);
  return updated;
}

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

export default {
  // Core formatting
  formatScientific,
  formatWithUncertainty,
  formatWithUnit,

  // Unit conversion
  convertUnit,

  // Date formatting
  formatScientificDate,

  // Preferences
  getUserPreferences,
  setUserPreferences,

  // Constants
  SI_PREFIXES,
  COMMON_UNITS,
};
