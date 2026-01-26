import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Shield, Download, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Confirmation Dialog Component (Task 14)
 *
 * A reusable confirmation dialog for high-risk actions:
 * - PHI access requests
 * - Data deletion
 * - Exports in LIVE mode
 *
 * Features:
 * - Danger variant with prominent styling
 * - Optional type-to-confirm for critical actions
 * - Accessible with proper ARIA labels
 * - Integrates with i18n
 */

export type ConfirmDialogVariant = 'default' | 'danger' | 'warning' | 'phi' | 'export';

export interface ConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog state changes */
  onOpenChange: (open: boolean) => void;
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
  /** Callback when confirmed */
  onConfirm: () => void | Promise<void>;
  /** Callback when cancelled */
  onCancel?: () => void;
  /** Whether the confirm action is in progress */
  isLoading?: boolean;
  /** Additional content to show in the dialog */
  children?: React.ReactNode;
}

const variantConfig: Record<ConfirmDialogVariant, {
  icon: typeof AlertTriangle;
  iconColor: string;
  confirmButtonClass: string;
}> = {
  default: {
    icon: AlertTriangle,
    iconColor: 'text-muted-foreground',
    confirmButtonClass: 'bg-primary hover:bg-primary/90',
  },
  danger: {
    icon: Trash2,
    iconColor: 'text-destructive',
    confirmButtonClass: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-yellow-500',
    confirmButtonClass: 'bg-yellow-500 hover:bg-yellow-600 text-white',
  },
  phi: {
    icon: Shield,
    iconColor: 'text-orange-500',
    confirmButtonClass: 'bg-orange-500 hover:bg-orange-600 text-white',
  },
  export: {
    icon: Download,
    iconColor: 'text-blue-500',
    confirmButtonClass: 'bg-blue-500 hover:bg-blue-600 text-white',
  },
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  cancelText,
  variant = 'default',
  typeToConfirm,
  onConfirm,
  onCancel,
  isLoading = false,
  children,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const [confirmInput, setConfirmInput] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  const config = variantConfig[variant];
  const Icon = config.icon;

  const isConfirmDisabled = typeToConfirm
    ? confirmInput !== typeToConfirm || isLoading || isConfirming
    : isLoading || isConfirming;

  const handleConfirm = useCallback(async () => {
    if (isConfirmDisabled) return;

    setIsConfirming(true);
    try {
      await onConfirm();
      onOpenChange(false);
      setConfirmInput('');
    } catch (error) {
      console.error('Confirm action failed:', error);
    } finally {
      setIsConfirming(false);
    }
  }, [isConfirmDisabled, onConfirm, onOpenChange]);

  const handleCancel = useCallback(() => {
    onCancel?.();
    onOpenChange(false);
    setConfirmInput('');
  }, [onCancel, onOpenChange]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-4">
            <div className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              variant === 'danger' && 'bg-destructive/10',
              variant === 'warning' && 'bg-yellow-500/10',
              variant === 'phi' && 'bg-orange-500/10',
              variant === 'export' && 'bg-blue-500/10',
              variant === 'default' && 'bg-muted'
            )}>
              <Icon className={cn('h-5 w-5', config.iconColor)} aria-hidden="true" />
            </div>
            <div className="flex-1">
              <AlertDialogTitle className="text-lg">{title}</AlertDialogTitle>
              <AlertDialogDescription className="mt-2">
                {description}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        {children && (
          <div className="mt-4 px-6">
            {children}
          </div>
        )}

        {typeToConfirm && (
          <div className="mt-4 px-6">
            <Label htmlFor="confirm-input" className="text-sm text-muted-foreground">
              {t('dialogs.confirm.typeToConfirm', { text: typeToConfirm })}
            </Label>
            <Input
              id="confirm-input"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={typeToConfirm}
              className="mt-2"
              autoComplete="off"
              disabled={isLoading || isConfirming}
            />
          </div>
        )}

        <AlertDialogFooter className="mt-6">
          <AlertDialogCancel
            onClick={handleCancel}
            disabled={isConfirming}
          >
            {cancelText || t('dialogs.confirm.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className={cn(config.confirmButtonClass, isConfirmDisabled && 'opacity-50 cursor-not-allowed')}
          >
            {isLoading || isConfirming ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Processing...
              </span>
            ) : (
              confirmText || t('dialogs.confirm.confirm')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Preset confirmation dialogs for common scenarios
 */

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  itemName,
  onConfirm,
  onCancel,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('dialogs.confirm.deleteTitle')}
      description={t('dialogs.confirm.deleteDescription')}
      confirmText={t('common.delete')}
      variant="danger"
      typeToConfirm={itemName}
      onConfirm={onConfirm}
      onCancel={onCancel}
      isLoading={isLoading}
    />
  );
}

export function PhiAccessDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  isLoading,
  reason,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  reason?: string;
}) {
  const { t } = useTranslation();

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('dialogs.confirm.phiTitle')}
      description={t('dialogs.confirm.phiDescription')}
      confirmText="Request Access"
      variant="phi"
      onConfirm={onConfirm}
      onCancel={onCancel}
      isLoading={isLoading}
    >
      {reason && (
        <div className="p-3 bg-muted rounded-md text-sm">
          <strong>Reason:</strong> {reason}
        </div>
      )}
    </ConfirmDialog>
  );
}

export function ExportConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  isLoading,
  exportType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  exportType?: string;
}) {
  const { t } = useTranslation();

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('dialogs.confirm.exportTitle')}
      description={t('dialogs.confirm.exportDescription')}
      confirmText={`Export ${exportType || 'Data'}`}
      variant="export"
      onConfirm={onConfirm}
      onCancel={onCancel}
      isLoading={isLoading}
    />
  );
}
