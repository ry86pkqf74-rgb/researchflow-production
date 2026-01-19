/**
 * Theme Application Utilities
 * Task 163: Apply custom theme variables to DOM
 */

import type { ThemeVars } from './tokens';
import { DEFAULT_THEME_VARS, THEME_STORAGE_KEY } from './tokens';

/**
 * Apply theme variables to document root
 */
export function applyThemeVars(vars: ThemeVars) {
  const root = document.documentElement;
  (Object.entries(vars) as [keyof ThemeVars, string][]).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

/**
 * Save theme variables to localStorage
 */
export function saveThemeVars(vars: ThemeVars) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(vars));
  } catch (e) {
    console.warn('Failed to save theme vars:', e);
  }
}

/**
 * Load theme variables from localStorage
 */
export function loadThemeVars(): ThemeVars {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate all keys exist
      const hasAllKeys = Object.keys(DEFAULT_THEME_VARS).every(
        (key) => key in parsed
      );
      if (hasAllKeys) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load theme vars:', e);
  }
  return DEFAULT_THEME_VARS;
}

/**
 * Initialize theme on app load
 */
export function initializeTheme() {
  const vars = loadThemeVars();
  applyThemeVars(vars);
}

/**
 * Reset theme to defaults
 */
export function resetTheme() {
  applyThemeVars(DEFAULT_THEME_VARS);
  saveThemeVars(DEFAULT_THEME_VARS);
}
