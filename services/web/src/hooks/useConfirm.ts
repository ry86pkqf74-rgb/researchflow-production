import { useState, useCallback, useRef } from 'react';

/**
 * useConfirm Hook (Task 14)
 *
 * A hook for programmatically triggering confirmation dialogs.
 *
 * Usage:
 * ```tsx
 * const { confirm, ConfirmDialogComponent } = useConfirm();
 *
 * const handleDelete = async () => {
 *   const confirmed = await confirm({
 *     title: 'Delete item?',
 *     description: 'This action cannot be undone.',
 *     variant: 'danger',
 *   });
 *
 *   if (confirmed) {
 *     // Perform deletion
 *   }
 * };
 *
 * return (
 *   <>
 *     <button onClick={handleDelete}>Delete</button>
 *     <ConfirmDialogComponent />
 *   </>
 * );
 * ```
 */

import type { ConfirmDialogVariant } from '@/components/dialogs/ConfirmDialog';

export interface ConfirmOptions {
  /** Dialog title */
  title: string;
  /** Dialog description */
  description: string;
  /** Text for confirm button */
  confirmText?: string;
  /** Text for cancel button */
  cancelText?: string;
  /** Variant determines styling */
  variant?: ConfirmDialogVariant;
  /** If set, user must type this text to confirm */
  typeToConfirm?: string;
  /** Additional content to show in the dialog */
  children?: React.ReactNode;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
}

interface ConfirmResolver {
  resolve: (value: boolean) => void;
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: '',
    description: '',
  });

  const resolverRef = useRef<ConfirmResolver | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    setState({
      ...options,
      open: true,
    });

    return new Promise<boolean>((resolve) => {
      resolverRef.current = { resolve };
    });
  }, []);

  const handleConfirm = useCallback(() => {
    resolverRef.current?.resolve(true);
    resolverRef.current = null;
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const handleCancel = useCallback(() => {
    resolverRef.current?.resolve(false);
    resolverRef.current = null;
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      handleCancel();
    }
  }, [handleCancel]);

  // Return both the confirm function and dialog props
  return {
    confirm,
    dialogProps: {
      ...state,
      onOpenChange: handleOpenChange,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
    isOpen: state.open,
  };
}

/**
 * Convenience hook for delete confirmations
 */
export function useDeleteConfirm() {
  const { confirm, dialogProps, isOpen } = useConfirm();

  const confirmDelete = useCallback(
    (itemName: string, description?: string): Promise<boolean> => {
      return confirm({
        title: 'Delete Confirmation',
        description: description || `Are you sure you want to delete "${itemName}"? This action cannot be undone.`,
        confirmText: 'Delete',
        variant: 'danger',
        typeToConfirm: itemName,
      });
    },
    [confirm]
  );

  return {
    confirmDelete,
    dialogProps,
    isOpen,
  };
}

/**
 * Convenience hook for PHI access confirmations
 */
export function usePhiAccessConfirm() {
  const { confirm, dialogProps, isOpen } = useConfirm();

  const confirmPhiAccess = useCallback(
    (reason?: string): Promise<boolean> => {
      return confirm({
        title: 'PHI Access Request',
        description: 'You are requesting access to data that may contain Protected Health Information (PHI). This action will be logged and audited.',
        confirmText: 'Request Access',
        variant: 'phi',
      });
    },
    [confirm]
  );

  return {
    confirmPhiAccess,
    dialogProps,
    isOpen,
  };
}

/**
 * Convenience hook for export confirmations
 */
export function useExportConfirm() {
  const { confirm, dialogProps, isOpen } = useConfirm();

  const confirmExport = useCallback(
    (exportType: string): Promise<boolean> => {
      return confirm({
        title: 'Export Confirmation',
        description: `You are about to export ${exportType}. Please ensure all PHI has been properly redacted before proceeding.`,
        confirmText: `Export ${exportType}`,
        variant: 'export',
      });
    },
    [confirm]
  );

  return {
    confirmExport,
    dialogProps,
    isOpen,
  };
}
