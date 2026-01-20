import { useEffect, useCallback, useRef } from 'react';

/**
 * Global Keyboard Shortcuts Manager (Task 17)
 *
 * Provides a system for registering and handling keyboard shortcuts:
 * - Ctrl+S / Cmd+S: Save current editor
 * - g d: Go to dashboard
 * - g w: Go to workflow
 *
 * Features:
 * - Ignores shortcuts when focused in inputs, textareas, or contenteditable
 * - Supports key sequences (e.g., "g d")
 * - Cross-platform (Ctrl on Windows/Linux, Cmd on Mac)
 * - Toast notifications for save confirmations
 */

export type ShortcutHandler = (event: KeyboardEvent) => void | boolean;

export interface Shortcut {
  /** Unique identifier for the shortcut */
  id: string;
  /** Display description */
  description: string;
  /** Key combination (e.g., "ctrl+s", "g d", "shift+?") */
  keys: string;
  /** Handler function */
  handler: ShortcutHandler;
  /** Category for grouping in help */
  category?: 'navigation' | 'editing' | 'actions' | 'general';
  /** Whether to prevent default browser behavior */
  preventDefault?: boolean;
  /** Whether shortcut is enabled */
  enabled?: boolean;
}

// Global shortcut registry
const shortcutRegistry = new Map<string, Shortcut>();

// Track key sequence for multi-key shortcuts
let keySequence: string[] = [];
let keySequenceTimer: ReturnType<typeof setTimeout> | null = null;

// Platform detection
const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

/**
 * Check if element should ignore shortcuts
 */
function shouldIgnoreShortcut(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement;
  const tagName = target.tagName.toLowerCase();

  // Ignore in form elements
  if (['input', 'textarea', 'select'].includes(tagName)) {
    return true;
  }

  // Ignore in contenteditable
  if (target.isContentEditable) {
    return true;
  }

  // Ignore in elements with specific roles
  const role = target.getAttribute('role');
  if (['textbox', 'searchbox', 'combobox'].includes(role || '')) {
    return true;
  }

  return false;
}

/**
 * Normalize key combination string
 */
function normalizeKey(key: string): string {
  return key
    .toLowerCase()
    .replace('meta', 'cmd')
    .replace('control', 'ctrl')
    .replace('arrow', '')
    .trim();
}

/**
 * Check if a key combination matches the current event
 */
function matchesShortcut(shortcut: Shortcut, event: KeyboardEvent, sequence: string[]): boolean {
  const keys = shortcut.keys.toLowerCase().split(/\s+/);

  // Single key combination (e.g., "ctrl+s")
  if (keys.length === 1 && keys[0].includes('+')) {
    const parts = keys[0].split('+');
    const key = parts.pop()!;
    const modifiers = parts;

    // Check modifiers
    const needsCtrl = modifiers.includes('ctrl') || modifiers.includes('cmd');
    const needsShift = modifiers.includes('shift');
    const needsAlt = modifiers.includes('alt');

    const hasCtrl = isMac ? event.metaKey : event.ctrlKey;
    const hasShift = event.shiftKey;
    const hasAlt = event.altKey;

    if (needsCtrl !== hasCtrl) return false;
    if (needsShift !== hasShift) return false;
    if (needsAlt !== hasAlt) return false;

    return normalizeKey(event.key) === key;
  }

  // Key sequence (e.g., "g d")
  if (keys.length > 1) {
    // Check if sequence matches
    if (sequence.length < keys.length) return false;

    const recentSequence = sequence.slice(-keys.length);
    return keys.every((k, i) => recentSequence[i] === k);
  }

  // Single key (e.g., "?")
  return normalizeKey(event.key) === keys[0];
}

/**
 * Global keyboard event handler
 */
function handleKeyDown(event: KeyboardEvent): void {
  // Check if should ignore
  if (shouldIgnoreShortcut(event)) {
    return;
  }

  // Add to sequence
  const key = normalizeKey(event.key);
  keySequence.push(key);

  // Reset sequence timer
  if (keySequenceTimer) {
    clearTimeout(keySequenceTimer);
  }
  keySequenceTimer = setTimeout(() => {
    keySequence = [];
  }, 500);

  // Check all registered shortcuts
  for (const shortcut of shortcutRegistry.values()) {
    if (shortcut.enabled === false) continue;

    if (matchesShortcut(shortcut, event, keySequence)) {
      if (shortcut.preventDefault !== false) {
        event.preventDefault();
        event.stopPropagation();
      }

      const result = shortcut.handler(event);

      // Clear sequence after handling
      keySequence = [];

      // If handler returns false, stop propagation
      if (result === false) {
        break;
      }
    }
  }
}

/**
 * Initialize the shortcut manager
 */
export function initializeShortcuts(): () => void {
  if (typeof window === 'undefined') return () => {};

  window.addEventListener('keydown', handleKeyDown);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    shortcutRegistry.clear();
  };
}

/**
 * Register a shortcut
 */
export function registerShortcut(shortcut: Shortcut): () => void {
  shortcutRegistry.set(shortcut.id, shortcut);

  return () => {
    shortcutRegistry.delete(shortcut.id);
  };
}

/**
 * Unregister a shortcut
 */
export function unregisterShortcut(id: string): void {
  shortcutRegistry.delete(id);
}

/**
 * Get all registered shortcuts
 */
export function getShortcuts(): Shortcut[] {
  return Array.from(shortcutRegistry.values());
}

/**
 * Format shortcut keys for display
 */
export function formatShortcutKeys(keys: string): string {
  return keys
    .split(/\s+/)
    .map(part => {
      if (part.includes('+')) {
        return part
          .split('+')
          .map(k => {
            if (k === 'ctrl' || k === 'cmd') return isMac ? '⌘' : 'Ctrl';
            if (k === 'shift') return isMac ? '⇧' : 'Shift';
            if (k === 'alt') return isMac ? '⌥' : 'Alt';
            return k.toUpperCase();
          })
          .join(isMac ? '' : '+');
      }
      return part.toUpperCase();
    })
    .join(' ');
}

/**
 * React hook for using shortcuts
 */
export function useShortcut(
  shortcut: Omit<Shortcut, 'id'> & { id?: string },
  deps: React.DependencyList = []
): void {
  const handlerRef = useRef(shortcut.handler);
  handlerRef.current = shortcut.handler;

  useEffect(() => {
    const id = shortcut.id || `shortcut-${shortcut.keys}-${Date.now()}`;

    const cleanup = registerShortcut({
      ...shortcut,
      id,
      handler: (event) => handlerRef.current(event),
    });

    return cleanup;
  }, deps);
}

/**
 * Hook to initialize global shortcuts
 */
export function useGlobalShortcuts(): void {
  useEffect(() => {
    return initializeShortcuts();
  }, []);
}

/**
 * Default shortcuts configuration
 */
export const defaultShortcuts: Omit<Shortcut, 'handler'>[] = [
  {
    id: 'save',
    keys: 'ctrl+s',
    description: 'Save current editor',
    category: 'editing',
  },
  {
    id: 'go-dashboard',
    keys: 'g d',
    description: 'Go to dashboard',
    category: 'navigation',
  },
  {
    id: 'go-workflow',
    keys: 'g w',
    description: 'Go to workflow',
    category: 'navigation',
  },
  {
    id: 'go-settings',
    keys: 'g s',
    description: 'Go to settings',
    category: 'navigation',
  },
  {
    id: 'go-search',
    keys: '/',
    description: 'Focus search',
    category: 'navigation',
  },
  {
    id: 'help',
    keys: 'shift+?',
    description: 'Show keyboard shortcuts',
    category: 'general',
  },
  {
    id: 'escape',
    keys: 'escape',
    description: 'Close dialog/modal',
    category: 'general',
    preventDefault: false,
  },
];
