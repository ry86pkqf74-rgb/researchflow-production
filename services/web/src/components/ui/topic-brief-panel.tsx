import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  Target,
  Users,
  FlaskConical,
  Scale,
  Clock,
  Lightbulb
} from "lucide-react";

interface PICOElement {
  id: string;
  label: string;
  value: string;
  icon: typeof Users;
}

interface Endpoint {
  type: "primary" | "secondary";
  name: string;
  description: string;
}

interface RiskWarning {
  type: "bias" | "confounding" | "limitation";
  severity: "high" | "medium" | "low";
  message: string;
}

interface TopicBriefPanelProps {
  scopeValues?: Record<string, string>;
  onExport?: (format: "pdf" | "md") => void;
}

export function TopicBriefPanel({ scopeValues, onExport }: TopicBriefPanelProps) {
  const [exporting, setExporting] = useState<"pdf" | "md" | null>(null);

  const picoElements: PICOElement[] = [
    {
      id: "population",
      label: "Population",
      value: scopeValues?.population || "Adults aged 40-65 with subclinical hypothyroidism (TSH 4.5-10 mIU/L)",
      icon: Users
    },
    {
      id: "intervention",
      label: "Intervention/Exposure",
      value: scopeValues?.intervention || "Levothyroxine therapy initiation vs. watchful waiting",
      icon: FlaskConical
    },
    {
      id: "comparator",
      label: "Comparator",
      value: scopeValues?.comparator || "Age and sex-matched euthyroid controls",
      icon: Scale
    },
    {
      id: "outcomes",
      label: "Outcomes",
      value: scopeValues?.outcomes || "Cardiovascular events (MI, stroke, CV death), quality of life measures",
      icon: Target
    },
    {
      id: "timeframe",
      label: "Timeframe",
      value: scopeValues?.timeframe || "5-year follow-up period (2018-2024)",
      icon: Clock
    }
  ];

  const endpoints: Endpoint[] = [
    { type: "primary", name: "Composite CV Events", description: "Time to first major adverse cardiovascular event (MACE)" },
    { type: "primary", name: "All-cause Mortality", description: "Death from any cause during follow-up" },
    { type: "secondary", name: "Heart Failure Hospitalization", description: "Admission for acute decompensated heart failure" },
    { type: "secondary", name: "Quality of Life", description: "SF-36 and ThyPRO questionnaire scores at 12, 24, 60 months" },
    { type: "secondary", name: "TSH Normalization", description: "Proportion achieving TSH 0.5-4.0 mIU/L" }
  ];

  const riskWarnings: RiskWarning[] = [
    { 
      type: "confounding", 
      severity: "high", 
      message: "Age is a significant confounder - consider stratified analysis or propensity matching" 
    },
    { 
      type: "bias", 
      severity: "medium", 
      message: "Selection bias possible - patients initiating therapy may have more severe symptoms" 
    },
    { 
      type: "limitation", 
      severity: "low", 
      message: "Single-center data may limit generalizability to diverse populations" 
    }
  ];

  const improvedStatement = `This retrospective cohort study investigates the association between subclinical hypothyroidism treatment decisions and cardiovascular outcomes in middle-aged adults. Using propensity-matched analysis of ${scopeValues?.population ? "the defined population" : "2,847 patients"} from the Thyroid Clinical Dataset (2018-2024), we aim to determine whether early levothyroxine initiation reduces the risk of major adverse cardiovascular events compared to conservative monitoring.`;

  const handleExport = async (format: "pdf" | "md") => {
    setExporting(format);
    try {
      const response = await fetch("/api/topic-brief/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          data: {
            improvedStatement,
            pico: picoElements,
            endpoints,
            riskWarnings,
            scopeValues
          }
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `topic-brief.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
      onExport?.(format);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setExporting(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high": return "text-red-500 bg-red-500/10 border-red-500/30";
      case "medium": return "text-amber-500 bg-amber-500/10 border-amber-500/30";
      default: return "text-blue-500 bg-blue-500/10 border-blue-500/30";
    }
  };

  return (
    <Card data-testid="card-topic-brief">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Topic Brief
            </CardTitle>
            <CardDescription>
              AI-refined research statement with structured PICO elements
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleExport("md")}
              disabled={exporting !== null}
              data-testid="button-export-md"
            >
              <Download className="h-4 w-4 mr-1" />
              {exporting === "md" ? "Exporting..." : "Markdown"}
            </Button>
            <Button 
              size="sm" 
              onClick={() => handleExport("pdf")}
              disabled={exporting !== null}
              data-testid="button-export-pdf"
            >
              <Download className="h-4 w-4 mr-1" />
              {exporting === "pdf" ? "Exporting..." : "PDF"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* AI-Improved Statement */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            AI-Improved Research Statement
          </div>
          <div className="p-4 bg-muted/50 rounded-lg text-sm leading-relaxed" data-testid="text-improved-statement">
            {improvedStatement}
          </div>
        </div>

        <Separator />

        {/* PICO Elements */}
        <div className="space-y-3">
          <div className="text-sm font-medium">PICO Framework</div>
          <div className="grid gap-3">
            {picoElements.map((element) => (
              <div 
                key={element.id} 
                className="flex items-start gap-3 p-3 bg-card border rounded-lg"
                data-testid={`card-pico-${element.id}`}
              >
                <div className="p-2 bg-primary/10 rounded-md">
                  <element.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {element.label}
                  </div>
                  <div className="text-sm mt-0.5" data-testid={`text-pico-${element.id}`}>
                    {element.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Candidate Endpoints */}
        <div className="space-y-3">
          <div className="text-sm font-medium">Candidate Endpoints</div>
          <div className="space-y-2">
            {endpoints.map((endpoint, idx) => (
              <div 
                key={idx} 
                className="flex items-center gap-3"
                data-testid={`row-endpoint-${idx}`}
              >
                <Badge 
                  variant={endpoint.type === "primary" ? "default" : "secondary"}
                  className="text-xs shrink-0"
                >
                  {endpoint.type}
                </Badge>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{endpoint.name}</span>
                  <span className="text-sm text-muted-foreground ml-2">- {endpoint.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Risk Warnings */}
        <div className="space-y-3">
          <div className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Risk & Limitation Alerts
          </div>
          <div className="space-y-2">
            {riskWarnings.map((warning, idx) => (
              <Alert 
                key={idx} 
                className={getSeverityColor(warning.severity)}
                data-testid={`alert-risk-${idx}`}
              >
                <AlertDescription className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs capitalize shrink-0">
                    {warning.type}
                  </Badge>
                  <span className="text-sm">{warning.message}</span>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </div>

        {/* Validation Status */}
        <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg" data-testid="status-topic-brief-valid">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">Topic Brief Complete</span>
          </div>
          <span className="text-xs text-muted-foreground">
            Ready to proceed to Literature Search
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
