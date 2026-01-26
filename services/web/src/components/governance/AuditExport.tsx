import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Download,
  Calendar,
  FileJson,
  FileSpreadsheet,
  Shield,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

type ExportFormat = "json" | "csv";

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface HashVerification {
  valid: boolean;
  entriesVerified: number;
  chainIntact: boolean;
  lastHash: string;
}

interface AuditExportResponse {
  downloadUrl: string;
  fileName: string;
  format: ExportFormat;
  recordCount: number;
  hashVerification: HashVerification;
}

interface AuditExportProps {
  variant?: "card" | "inline";
}

const DATE_PRESETS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "All time", days: 0 },
];

export function AuditExport({ variant = "card" }: AuditExportProps) {
  const { toast } = useToast();
  const [exportFormat, setExportFormat] = useState<ExportFormat>("json");
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [verificationResult, setVerificationResult] = useState<HashVerification | null>(null);

  const exportMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams({
        format: exportFormat,
        includeVerification: "true",
      });

      if (dateRange.from) {
        params.append("startDate", startOfDay(dateRange.from).toISOString());
      }
      if (dateRange.to) {
        params.append("endDate", endOfDay(dateRange.to).toISOString());
      }

      const response = await fetch(`/api/governance/audit/export?${params}`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Export failed");
      }

      const contentType = response.headers.get("content-type");

      if (contentType?.includes("application/json")) {
        const data = await response.json();
        if (data.hashVerification) {
          setVerificationResult(data.hashVerification);
        }
        return data as AuditExportResponse;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const fileName = `audit-log-${format(new Date(), "yyyy-MM-dd")}.${exportFormat}`;

      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      return {
        downloadUrl: url,
        fileName,
        format: exportFormat,
        recordCount: 0,
        hashVerification: { valid: true, entriesVerified: 0, chainIntact: true, lastHash: "" },
      };
    },
    onSuccess: (data) => {
      toast({
        title: "Export Complete",
        description: `Audit log exported as ${data.format.toUpperCase()} with ${data.recordCount || "all"} records.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePresetClick = (days: number) => {
    if (days === 0) {
      setDateRange({ from: undefined, to: undefined });
    } else {
      setDateRange({
        from: subDays(new Date(), days),
        to: new Date(),
      });
    }
  };

  const content = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Date Range:</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {DATE_PRESETS.map((preset) => (
            <Button
              key={preset.days}
              variant="outline"
              size="sm"
              onClick={() => handlePresetClick(preset.days)}
              className={
                (preset.days === 0 && !dateRange.from) ||
                (preset.days > 0 &&
                  dateRange.from &&
                  Math.abs(
                    (new Date().getTime() - dateRange.from.getTime()) /
                      (1000 * 60 * 60 * 24)
                  ) === preset.days)
                  ? "bg-primary/10 border-primary/30"
                  : ""
              }
              data-testid={`button-preset-${preset.days}`}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-date-picker">
              <Calendar className="h-4 w-4 mr-2" />
              {dateRange.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "MMM d, yyyy")} -{" "}
                    {format(dateRange.to, "MMM d, yyyy")}
                  </>
                ) : (
                  format(dateRange.from, "MMM d, yyyy")
                )
              ) : (
                "Pick a date range"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="range"
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range) =>
                setDateRange({ from: range?.from, to: range?.to })
              }
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Format:</span>
          <Select
            value={exportFormat}
            onValueChange={(value) => setExportFormat(value as ExportFormat)}
          >
            <SelectTrigger className="w-[120px]" data-testid="select-export-format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="json">
                <div className="flex items-center gap-2">
                  <FileJson className="h-4 w-4" />
                  JSON
                </div>
              </SelectItem>
              <SelectItem value="csv">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  CSV
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending}
          data-testid="button-export-audit"
        >
          {exportMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export Audit Trail
        </Button>
      </div>

      {verificationResult && (
        <div
          className={`p-3 rounded-lg border ${
            verificationResult.valid
              ? "bg-green-500/10 border-green-500/30"
              : "bg-red-500/10 border-red-500/30"
          }`}
          data-testid="hash-verification-result"
        >
          <div className="flex items-center gap-2 mb-2">
            {verificationResult.valid ? (
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : (
              <Shield className="h-4 w-4 text-red-600 dark:text-red-400" />
            )}
            <span className="font-medium text-sm">
              Hash Chain Verification: {verificationResult.valid ? "Valid" : "Invalid"}
            </span>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Entries verified: {verificationResult.entriesVerified}</p>
            <p>Chain integrity: {verificationResult.chainIntact ? "Intact" : "Broken"}</p>
            {verificationResult.lastHash && (
              <p className="font-mono truncate" title={verificationResult.lastHash}>
                Last hash: {verificationResult.lastHash.slice(0, 16)}...
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (variant === "inline") {
    return content;
  }

  return (
    <Card data-testid="audit-export">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-primary" />
          Audit Trail Export
        </CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
