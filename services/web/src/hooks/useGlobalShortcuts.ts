import { useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useToast } from './use-toast';
import {
  useGlobalShortcuts as useShortcutsInit,
  registerShortcut,
  formatShortcutKeys,
  type Shortcut,
} from '@/lib/shortcuts';

/**
 * Global Shortcuts Provider Hook (Task 17)
 *
 * Installs default application shortcuts:
 * - Ctrl+S / Cmd+S: Save current context
 * - g d: Navigate to dashboard
 * - g w: Navigate to workflow
 * - g s: Navigate to settings
 * - /: Focus search
 * - ?: Show shortcuts help
 */

interface UseGlobalShortcutsOptions {
  /** Callback when save is triggered */
  onSave?: () => void | Promise<void>;
  /** Custom shortcuts to register */
  customShortcuts?: Shortcut[];
}

export function useAppShortcuts(options: UseGlobalShortcutsOptions = {}) {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Initialize shortcut system
  useShortcutsInit();

  // Save shortcut
  useEffect(() => {
    if (!options.onSave) return;

    return registerShortcut({
      id: 'app-save',
      keys: 'ctrl+s',
      description: 'Save current context',
      category: 'editing',
      handler: () => {
        Promise.resolve(options.onSave?.()).then(() => {
          toast({
            title: 'Saved',
            description: 'Your changes have been saved.',
          });
        }).catch((error) => {
          toast({
            title: 'Save failed',
            description: error instanceof Error ? error.message : 'An error occurred',
            variant: 'destructive',
          });
        });
      },
    });
  }, [options.onSave, toast]);

  // Navigation shortcuts
  useEffect(() => {
    const shortcuts = [
      registerShortcut({
        id: 'nav-dashboard',
        keys: 'g d',
        description: 'Go to dashboard',
        category: 'navigation',
        handler: () => {
          navigate('/pipeline');
          toast({
            title: 'Navigation',
            description: 'Navigated to Dashboard',
            duration: 1500,
          });
        },
      }),
      registerShortcut({
        id: 'nav-workflow',
        keys: 'g w',
        description: 'Go to workflow',
        category: 'navigation',
        handler: () => {
          navigate('/workflow');
          toast({
            title: 'Navigation',
            description: 'Navigated to Workflow',
            duration: 1500,
          });
        },
      }),
      registerShortcut({
        id: 'nav-workflows',
        keys: 'g b',
        description: 'Go to workflow builder',
        category: 'navigation',
        handler: () => {
          navigate('/workflows');
          toast({
            title: 'Navigation',
            description: 'Navigated to Workflow Builder',
            duration: 1500,
          });
        },
      }),
      registerShortcut({
        id: 'nav-settings',
        keys: 'g s',
        description: 'Go to settings',
        category: 'navigation',
        handler: () => {
          navigate('/settings');
          toast({
            title: 'Navigation',
            description: 'Navigated to Settings',
            duration: 1500,
          });
        },
      }),
      registerShortcut({
        id: 'nav-search',
        keys: 'g f',
        description: 'Go to search',
        category: 'navigation',
        handler: () => {
          navigate('/search');
        },
      }),
      registerShortcut({
        id: 'nav-governance',
        keys: 'g g',
        description: 'Go to governance',
        category: 'navigation',
        handler: () => {
          navigate('/governance');
          toast({
            title: 'Navigation',
            description: 'Navigated to Governance',
            duration: 1500,
          });
        },
      }),
    ];

    return () => {
      shortcuts.forEach(cleanup => cleanup());
    };
  }, [navigate, toast]);

  // Help shortcut - show keyboard shortcuts dialog
  useEffect(() => {
    return registerShortcut({
      id: 'show-help',
      keys: 'shift+?',
      description: 'Show keyboard shortcuts',
      category: 'general',
      handler: () => {
        // Create a custom event that can be handled by a dialog component
        window.dispatchEvent(new CustomEvent('show-shortcuts-help'));

        // Display shortcuts as formatted text
        const shortcuts = [
          `${formatShortcutKeys('g d')} - Go to Dashboard`,
          `${formatShortcutKeys('g w')} - Go to Workflow`,
          `${formatShortcutKeys('g s')} - Go to Settings`,
          `${formatShortcutKeys('ctrl+s')} - Save`,
        ].join('\n');

        toast({
          title: 'Keyboard Shortcuts',
          description: shortcuts,
          duration: 5000,
        });
      },
    });
  }, [toast]);

  // Register custom shortcuts
  useEffect(() => {
    if (!options.customShortcuts?.length) return;

    const cleanups = options.customShortcuts.map(shortcut =>
      registerShortcut(shortcut)
    );

    return () => {
      cleanups.forEach(cleanup => cleanup());
    };
  }, [options.customShortcuts]);
}

/**
 * Hook for page-specific save functionality
 */
export function useSaveShortcut(onSave: () => void | Promise<void>, deps: React.DependencyList = []) {
  const { toast } = useToast();

  useEffect(() => {
    return registerShortcut({
      id: 'page-save',
      keys: 'ctrl+s',
      description: 'Save',
      category: 'editing',
      handler: () => {
        Promise.resolve(onSave()).then(() => {
          toast({
            title: 'Saved',
            description: 'Your changes have been saved.',
          });
        }).catch((error) => {
          toast({
            title: 'Save failed',
            description: error instanceof Error ? error.message : 'An error occurred',
            variant: 'destructive',
          });
        });
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSave, toast, ...deps]);
}
