import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  ClipboardCheck,
  Download,
  Loader2,
  Shield,
  Eye,
  FileCheck,
  AlertCircle,
} from "lucide-react";

export interface HumanReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exportType?: string;
  exportName?: string;
  onConfirmExport: () => Promise<void>;
  onCancel: () => void;
}

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const checklistItems: ChecklistItem[] = [
  {
    id: "no-phi",
    label: "I confirm no PHI is included in this export",
    description:
      "All protected health information has been removed or properly de-identified",
    icon: <Shield className="w-4 h-4 text-blue-500" />,
  },
  {
    id: "reviewed-compliance",
    label: "I have reviewed all output for compliance",
    description:
      "The exported content adheres to institutional and regulatory requirements",
    icon: <Eye className="w-4 h-4 text-green-500" />,
  },
  {
    id: "understand-logging",
    label: "I understand this export will be logged",
    description:
      "This action will be recorded in the audit trail for compliance tracking",
    icon: <FileCheck className="w-4 h-4 text-amber-500" />,
  },
];

export function HumanReviewModal({
  open,
  onOpenChange,
  exportType = "data",
  exportName,
  onConfirmExport,
  onCancel,
}: HumanReviewModalProps) {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  const allChecked = checklistItems.every((item) => checkedItems.has(item.id));

  const handleCheckChange = (itemId: string, checked: boolean) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(itemId);
      } else {
        next.delete(itemId);
      }
      return next;
    });
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onConfirmExport();
      setCheckedItems(new Set());
      onOpenChange(false);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCancel = () => {
    setCheckedItems(new Set());
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        data-testid="modal-human-review"
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <DialogTitle>Pre-Export Review</DialogTitle>
              <DialogDescription>
                Please confirm the following before exporting
                {exportName && (
                  <span className="font-medium"> "{exportName}"</span>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 rounded-lg bg-muted/50 border flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              This {exportType} export requires human attestation before
              proceeding. All confirmations must be checked to enable the export
              action.
            </p>
          </div>

          <div className="space-y-3">
            {checklistItems.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover-elevate transition-colors"
              >
                <Checkbox
                  id={item.id}
                  checked={checkedItems.has(item.id)}
                  onCheckedChange={(checked) =>
                    handleCheckChange(item.id, checked === true)
                  }
                  data-testid={`checkbox-${item.id}`}
                />
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    {item.icon}
                    <Label
                      htmlFor={item.id}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {item.label}
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground pt-2">
            <span>
              {checkedItems.size} of {checklistItems.length} confirmations
              completed
            </span>
            {allChecked && (
              <span className="text-green-600 dark:text-green-400 font-medium">
                Ready to export
              </span>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isExporting}
            data-testid="button-review-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={!allChecked || isExporting}
            data-testid="button-review-export"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
