import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  CheckCircle,
  Circle,
  AlertCircle,
  Download,
  FileText,
  Clock,
  Loader2,
  Send,
} from "lucide-react";

export interface ConferenceRequirement {
  id: string;
  name: string;
  description?: string;
  required: boolean;
}

export interface ChecklistItem {
  id: string;
  name: string;
  description?: string;
  required: boolean;
  checked: boolean;
  checkedAt?: string;
  checkedBy?: string;
}

export interface ComplianceChecklistProps {
  projectId: string;
  conferenceRequirements?: ConferenceRequirement[];
  onSubmit?: () => void;
  onCancel?: () => void;
}

interface ChecklistResponse {
  items: ChecklistItem[];
  projectId: string;
  conferenceName?: string;
}

export function ComplianceChecklist({
  projectId,
  conferenceRequirements,
  onSubmit,
  onCancel,
}: ComplianceChecklistProps) {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: checklistData, isLoading, error } = useQuery<ChecklistResponse>({
    queryKey: ["/api/ros/checklist", projectId],
    enabled: !!projectId,
  });

  const checkItemMutation = useMutation({
    mutationFn: async ({ itemId, checked }: { itemId: string; checked: boolean }) => {
      const response = await apiRequest("POST", `/api/ros/checklist/${projectId}/check`, {
        itemId,
        checked,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ros/checklist", projectId] });
    },
  });

  const items: ChecklistItem[] = checklistData?.items || 
    conferenceRequirements?.map((req) => ({
      ...req,
      checked: false,
      checkedAt: undefined,
      checkedBy: undefined,
    })) || [];

  const requiredItems = items.filter((item) => item.required);
  const optionalItems = items.filter((item) => !item.required);
  const checkedCount = items.filter((item) => item.checked).length;
  const requiredCheckedCount = requiredItems.filter((item) => item.checked).length;
  const allRequiredChecked = requiredItems.length === requiredCheckedCount;
  const progressPercent = items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0;

  const handleCheckChange = async (itemId: string, checked: boolean) => {
    await checkItemMutation.mutateAsync({ itemId, checked });
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const pdfContent = generatePdfContent(items, checklistData?.conferenceName || "Conference", timestamp);
      
      const blob = new Blob([pdfContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `compliance-checklist-${projectId}-${timestamp}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleSubmit = async () => {
    if (!allRequiredChecked) return;
    setIsSubmitting(true);
    try {
      await apiRequest("POST", `/api/ros/checklist/${projectId}/submit`, {});
      onSubmit?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return null;
    return new Date(timestamp).toLocaleString();
  };

  if (isLoading) {
    return (
      <Card data-testid="card-compliance-checklist-loading">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading checklist...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="card-compliance-checklist-error">
        <CardContent className="flex items-center justify-center py-12">
          <AlertCircle className="w-6 h-6 text-destructive" />
          <span className="ml-2 text-destructive">Failed to load checklist</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-compliance-checklist">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Compliance Checklist
          </CardTitle>
          <CardDescription>
            Complete all required items before submission
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportPdf}
          disabled={isExportingPdf}
          data-testid="button-export-pdf"
        >
          {isExportingPdf ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Export PDF
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {checkedCount} of {items.length} items completed
            </span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} data-testid="progress-checklist" />
          {!allRequiredChecked && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {requiredItems.length - requiredCheckedCount} required item(s) remaining
            </p>
          )}
        </div>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-6">
            {requiredItems.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <span className="text-destructive">*</span>
                  Required Items ({requiredCheckedCount}/{requiredItems.length})
                </h4>
                <div className="space-y-2">
                  {requiredItems.map((item) => (
                    <ChecklistItemRow
                      key={item.id}
                      item={item}
                      onCheckChange={handleCheckChange}
                      isPending={checkItemMutation.isPending}
                      formatTimestamp={formatTimestamp}
                    />
                  ))}
                </div>
              </div>
            )}

            {optionalItems.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground">
                  Optional Items ({optionalItems.filter((i) => i.checked).length}/{optionalItems.length})
                </h4>
                <div className="space-y-2">
                  {optionalItems.map((item) => (
                    <ChecklistItemRow
                      key={item.id}
                      item={item}
                      onCheckChange={handleCheckChange}
                      isPending={checkItemMutation.isPending}
                      formatTimestamp={formatTimestamp}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-4 border-t pt-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {allRequiredChecked ? (
            <>
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-green-600 dark:text-green-400">Ready to submit</span>
            </>
          ) : (
            <>
              <Circle className="w-4 h-4" />
              <span>Complete all required items to submit</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
              data-testid="button-checklist-cancel"
            >
              Cancel
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={!allRequiredChecked || isSubmitting}
            data-testid="button-checklist-submit"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Submit
              </>
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

interface ChecklistItemRowProps {
  item: ChecklistItem;
  onCheckChange: (itemId: string, checked: boolean) => Promise<void>;
  isPending: boolean;
  formatTimestamp: (timestamp?: string) => string | null;
}

function ChecklistItemRow({
  item,
  onCheckChange,
  isPending,
  formatTimestamp,
}: ChecklistItemRowProps) {
  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg border bg-card hover-elevate transition-colors"
      data-testid={`checklist-item-${item.id}`}
    >
      <Checkbox
        id={`checklist-${item.id}`}
        checked={item.checked}
        onCheckedChange={(checked) => onCheckChange(item.id, checked === true)}
        disabled={isPending}
        data-testid={`checkbox-${item.id}`}
      />
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Label
            htmlFor={`checklist-${item.id}`}
            className="text-sm font-medium cursor-pointer"
          >
            {item.name}
          </Label>
          {item.required && (
            <Badge variant="destructive" className="text-xs" data-testid={`badge-required-${item.id}`}>
              Required
            </Badge>
          )}
          {item.checked && (
            <Badge variant="secondary" className="text-xs" data-testid={`badge-complete-${item.id}`}>
              <CheckCircle className="w-3 h-3 mr-1" />
              Complete
            </Badge>
          )}
        </div>
        {item.description && (
          <p className="text-xs text-muted-foreground">{item.description}</p>
        )}
        {item.checked && item.checkedAt && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Checked: {formatTimestamp(item.checkedAt)}
            {item.checkedBy && <span>by {item.checkedBy}</span>}
          </p>
        )}
      </div>
    </div>
  );
}

function generatePdfContent(
  items: ChecklistItem[],
  conferenceName: string,
  timestamp: string
): string {
  const lines: string[] = [
    "=".repeat(60),
    "COMPLIANCE CHECKLIST REPORT",
    "=".repeat(60),
    "",
    `Conference: ${conferenceName}`,
    `Generated: ${new Date(timestamp.replace(/-/g, ":").replace("T", " ").slice(0, -4)).toLocaleString()}`,
    "",
    "-".repeat(60),
    "SUMMARY",
    "-".repeat(60),
    "",
    `Total Items: ${items.length}`,
    `Completed: ${items.filter((i) => i.checked).length}`,
    `Required Items: ${items.filter((i) => i.required).length}`,
    `Required Completed: ${items.filter((i) => i.required && i.checked).length}`,
    "",
    "-".repeat(60),
    "REQUIRED ITEMS",
    "-".repeat(60),
    "",
  ];

  const requiredItems = items.filter((i) => i.required);
  requiredItems.forEach((item, index) => {
    lines.push(`${index + 1}. [${item.checked ? "X" : " "}] ${item.name}`);
    if (item.description) {
      lines.push(`   ${item.description}`);
    }
    if (item.checked && item.checkedAt) {
      lines.push(`   Checked: ${new Date(item.checkedAt).toLocaleString()}`);
      if (item.checkedBy) {
        lines.push(`   By: ${item.checkedBy}`);
      }
    }
    lines.push("");
  });

  const optionalItems = items.filter((i) => !i.required);
  if (optionalItems.length > 0) {
    lines.push("-".repeat(60));
    lines.push("OPTIONAL ITEMS");
    lines.push("-".repeat(60));
    lines.push("");

    optionalItems.forEach((item, index) => {
      lines.push(`${index + 1}. [${item.checked ? "X" : " "}] ${item.name}`);
      if (item.description) {
        lines.push(`   ${item.description}`);
      }
      if (item.checked && item.checkedAt) {
        lines.push(`   Checked: ${new Date(item.checkedAt).toLocaleString()}`);
        if (item.checkedBy) {
          lines.push(`   By: ${item.checkedBy}`);
        }
      }
      lines.push("");
    });
  }

  lines.push("=".repeat(60));
  lines.push("END OF REPORT");
  lines.push("=".repeat(60));

  return lines.join("\n");
}
