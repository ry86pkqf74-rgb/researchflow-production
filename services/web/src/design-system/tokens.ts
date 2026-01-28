/**
 * ResearchFlow Design System Tokens
 * Extracted from Figma: ResearchFlow Canvas - Design System
 * Generated: 2026-01-28
 */

export const colors = {
  // Primary palette
  primary: {
    DEFAULT: '#4A7FC1', // Blue
    hover: '#3D6BA8',
    light: '#E8F0F8',
  },
  success: {
    DEFAULT: '#4CAF50', // Green
    hover: '#43A047',
    light: '#E8F5E9',
  },
  workflow: {
    DEFAULT: '#9575CD', // Purple
    hover: '#7E57C2',
    light: '#EDE7F6',
  },
  error: {
    DEFAULT: '#E57373', // Red
    hover: '#EF5350',
    light: '#FFEBEE',
  },

  // Neutral palette
  background: {
    DEFAULT: '#F5F5F5',
    card: '#FFFFFF',
    dark: '#1A1A1A',
  },
  text: {
    DEFAULT: '#212121',
    secondary: '#757575',
    light: '#FFFFFF',
  },
  border: {
    DEFAULT: '#E0E0E0',
    focus: '#4A7FC1',
  },
} as const;

export const typography = {
  display: {
    fontSize: '48px',
    fontWeight: 700,
    lineHeight: 1.2,
  },
  h1: {
    fontSize: '32px',
    fontWeight: 600,
    lineHeight: 1.3,
  },
  h2: {
    fontSize: '24px',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  body: {
    fontSize: '16px',
    fontWeight: 400,
    lineHeight: 1.5,
  },
  caption: {
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: 1.4,
  },
} as const;

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
} as const;

export const borderRadius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
} as const;

export type ColorKey = keyof typeof colors;
export type TypographyKey = keyof typeof typography;
