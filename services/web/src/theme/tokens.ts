/**
 * Theme Tokens
 * Task 163: Custom theme editor with CSS variables
 */

export type ThemeVars = {
  '--ros-primary': string;
  '--ros-primary-foreground': string;
  '--ros-secondary': string;
  '--ros-secondary-foreground': string;
  '--ros-success': string;
  '--ros-success-foreground': string;
  '--ros-warning': string;
  '--ros-warning-foreground': string;
  '--ros-alert': string;
  '--ros-alert-foreground': string;
  '--ros-workflow': string;
  '--ros-workflow-foreground': string;
  '--ros-accent': string;
  '--ros-accent-foreground': string;
};

export const DEFAULT_THEME_VARS: ThemeVars = {
  '--ros-primary': '#3b82f6',
  '--ros-primary-foreground': '#ffffff',
  '--ros-secondary': '#64748b',
  '--ros-secondary-foreground': '#ffffff',
  '--ros-success': '#10b981',
  '--ros-success-foreground': '#ffffff',
  '--ros-warning': '#f59e0b',
  '--ros-warning-foreground': '#000000',
  '--ros-alert': '#ef4444',
  '--ros-alert-foreground': '#ffffff',
  '--ros-workflow': '#8b5cf6',
  '--ros-workflow-foreground': '#ffffff',
  '--ros-accent': '#06b6d4',
  '--ros-accent-foreground': '#ffffff',
};

// Preset themes
export const THEME_PRESETS: Record<string, ThemeVars> = {
  default: DEFAULT_THEME_VARS,
  ocean: {
    '--ros-primary': '#0ea5e9',
    '--ros-primary-foreground': '#ffffff',
    '--ros-secondary': '#475569',
    '--ros-secondary-foreground': '#ffffff',
    '--ros-success': '#22c55e',
    '--ros-success-foreground': '#ffffff',
    '--ros-warning': '#eab308',
    '--ros-warning-foreground': '#000000',
    '--ros-alert': '#f43f5e',
    '--ros-alert-foreground': '#ffffff',
    '--ros-workflow': '#6366f1',
    '--ros-workflow-foreground': '#ffffff',
    '--ros-accent': '#14b8a6',
    '--ros-accent-foreground': '#ffffff',
  },
  forest: {
    '--ros-primary': '#16a34a',
    '--ros-primary-foreground': '#ffffff',
    '--ros-secondary': '#57534e',
    '--ros-secondary-foreground': '#ffffff',
    '--ros-success': '#84cc16',
    '--ros-success-foreground': '#000000',
    '--ros-warning': '#ca8a04',
    '--ros-warning-foreground': '#ffffff',
    '--ros-alert': '#dc2626',
    '--ros-alert-foreground': '#ffffff',
    '--ros-workflow': '#7c3aed',
    '--ros-workflow-foreground': '#ffffff',
    '--ros-accent': '#0d9488',
    '--ros-accent-foreground': '#ffffff',
  },
  sunset: {
    '--ros-primary': '#f97316',
    '--ros-primary-foreground': '#ffffff',
    '--ros-secondary': '#78716c',
    '--ros-secondary-foreground': '#ffffff',
    '--ros-success': '#65a30d',
    '--ros-success-foreground': '#ffffff',
    '--ros-warning': '#fbbf24',
    '--ros-warning-foreground': '#000000',
    '--ros-alert': '#e11d48',
    '--ros-alert-foreground': '#ffffff',
    '--ros-workflow': '#a855f7',
    '--ros-workflow-foreground': '#ffffff',
    '--ros-accent': '#ec4899',
    '--ros-accent-foreground': '#ffffff',
  },
};

export const THEME_STORAGE_KEY = 'ros-theme-vars';
