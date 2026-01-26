import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  BarChart3,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Database,
  Search,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { Link } from "wouter";

// Types for quality data
interface DatasetQualityMetrics {
  datasetId: string;
  datasetName: string;
  recordCount: number;
  columnCount: number;
  completeness: number;
  validity: number;
  uniqueness: number;
  timeliness: number;
  overallScore: number;
  lastProfiledAt: string;
  issues: QualityIssue[];
}

interface QualityIssue {
  type: "missing" | "invalid" | "duplicate" | "outlier";
  column: string;
  severity: "low" | "medium" | "high";
  count: number;
  description: string;
}

interface ProfilingReport {
  reportId: string;
  datasetName: string;
  generatedAt: string;
  recordCount: number;
  variableTypes: Record<string, number>;
  missingPercent: number;
  duplicatePercent: number;
  alerts: string[];
}

interface QualityDashboardData {
  datasets: DatasetQualityMetrics[];
  recentReports: ProfilingReport[];
  overallHealth: {
    totalDatasets: number;
    healthyDatasets: number;
    warningDatasets: number;
    criticalDatasets: number;
    averageScore: number;
  };
}

function getScoreColor(score: number): string {
  if (score >= 90) return "text-ros-success";
  if (score >= 70) return "text-amber-500";
  return "text-ros-alert";
}

function getScoreBadge(score: number) {
  if (score >= 90) return <Badge className="bg-ros-success/10 text-ros-success">Excellent</Badge>;
  if (score >= 70) return <Badge className="bg-amber-500/10 text-amber-600">Good</Badge>;
  if (score >= 50) return <Badge className="bg-orange-500/10 text-orange-600">Fair</Badge>;
  return <Badge className="bg-ros-alert/10 text-ros-alert">Poor</Badge>;
}

function HealthOverviewCard({ health }: { health: QualityDashboardData["overallHealth"] }) {
  return (
    <Card data-testid="card-health-overview">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Data Quality Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <Database className="h-5 w-5 mx-auto mb-1 text-ros-primary" />
            <div className="text-2xl font-bold">{health.totalDatasets}</div>
            <div className="text-xs text-muted-foreground">Datasets</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-ros-success" />
            <div className="text-2xl font-bold">{health.healthyDatasets}</div>
            <div className="text-xs text-muted-foreground">Healthy</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-amber-500" />
            <div className="text-2xl font-bold">{health.warningDatasets}</div>
            <div className="text-xs text-muted-foreground">Warning</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <XCircle className="h-5 w-5 mx-auto mb-1 text-ros-alert" />
            <div className="text-2xl font-bold">{health.criticalDatasets}</div>
            <div className="text-xs text-muted-foreground">Critical</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <TrendingUp className={`h-5 w-5 mx-auto mb-1 ${getScoreColor(health.averageScore)}`} />
            <div className="text-2xl font-bold">{health.averageScore}%</div>
            <div className="text-xs text-muted-foreground">Avg Score</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DatasetQualityCard({ dataset }: { dataset: DatasetQualityMetrics }) {
  const highSeverityIssues = dataset.issues.filter(i => i.severity === "high").length;
  const mediumSeverityIssues = dataset.issues.filter(i => i.severity === "medium").length;

  return (
    <Card data-testid={`card-dataset-${dataset.datasetId}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{dataset.datasetName}</CardTitle>
            <CardDescription>
              {dataset.recordCount.toLocaleString()} records, {dataset.columnCount} columns
            </CardDescription>
          </div>
          {getScoreBadge(dataset.overallScore)}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Completeness</div>
              <div className="flex items-center gap-2">
                <Progress value={dataset.completeness} className="h-2 flex-1" />
                <span className="text-sm font-medium">{dataset.completeness}%</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Validity</div>
              <div className="flex items-center gap-2">
                <Progress value={dataset.validity} className="h-2 flex-1" />
                <span className="text-sm font-medium">{dataset.validity}%</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Uniqueness</div>
              <div className="flex items-center gap-2">
                <Progress value={dataset.uniqueness} className="h-2 flex-1" />
                <span className="text-sm font-medium">{dataset.uniqueness}%</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Timeliness</div>
              <div className="flex items-center gap-2">
                <Progress value={dataset.timeliness} className="h-2 flex-1" />
                <span className="text-sm font-medium">{dataset.timeliness}%</span>
              </div>
            </div>
          </div>

          {dataset.issues.length > 0 && (
            <div className="flex items-center gap-3 text-sm">
              {highSeverityIssues > 0 && (
                <span className="flex items-center gap-1 text-ros-alert">
                  <AlertCircle className="h-3 w-3" />
                  {highSeverityIssues} critical
                </span>
              )}
              {mediumSeverityIssues > 0 && (
                <span className="flex items-center gap-1 text-amber-500">
                  <AlertTriangle className="h-3 w-3" />
                  {mediumSeverityIssues} warnings
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Last profiled: {new Date(dataset.lastProfiledAt).toLocaleDateString()}</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              View Details
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportCard({ report }: { report: ProfilingReport }) {
  return (
    <Card data-testid={`card-report-${report.reportId}`}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <div>
              <div className="font-medium">{report.datasetName}</div>
              <div className="text-sm text-muted-foreground">
                {report.recordCount.toLocaleString()} records
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm">{new Date(report.generatedAt).toLocaleDateString()}</div>
            <div className="text-xs text-muted-foreground">
              {report.alerts.length} alerts
            </div>
          </div>
        </div>
        {report.alerts.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="text-xs text-muted-foreground mb-2">Top Alerts:</div>
            <div className="space-y-1">
              {report.alerts.slice(0, 3).map((alert, i) => (
                <div key={i} className="text-xs flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  <span className="truncate">{alert}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32 w-full" />
      <div className="grid gap-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}

// Mock data for demonstration (replace with actual API call)
const mockQualityData: QualityDashboardData = {
  datasets: [
    {
      datasetId: "ds-1",
      datasetName: "Patient Demographics",
      recordCount: 15420,
      columnCount: 24,
      completeness: 94,
      validity: 98,
      uniqueness: 100,
      timeliness: 85,
      overallScore: 94,
      lastProfiledAt: new Date().toISOString(),
      issues: [
        { type: "missing", column: "middle_name", severity: "low", count: 823, description: "Missing middle names" },
      ],
    },
    {
      datasetId: "ds-2",
      datasetName: "Lab Results",
      recordCount: 48230,
      columnCount: 18,
      completeness: 78,
      validity: 92,
      uniqueness: 99,
      timeliness: 95,
      overallScore: 72,
      lastProfiledAt: new Date(Date.now() - 86400000).toISOString(),
      issues: [
        { type: "missing", column: "reference_range", severity: "high", count: 5420, description: "Missing reference ranges" },
        { type: "outlier", column: "value", severity: "medium", count: 142, description: "Potential outlier values" },
      ],
    },
  ],
  recentReports: [
    {
      reportId: "rpt-1",
      datasetName: "Patient Demographics",
      generatedAt: new Date().toISOString(),
      recordCount: 15420,
      variableTypes: { numeric: 8, categorical: 12, datetime: 4 },
      missingPercent: 6,
      duplicatePercent: 0,
      alerts: ["6% missing values overall", "High cardinality in 'address' column"],
    },
    {
      reportId: "rpt-2",
      datasetName: "Lab Results",
      generatedAt: new Date(Date.now() - 86400000).toISOString(),
      recordCount: 48230,
      variableTypes: { numeric: 12, categorical: 4, datetime: 2 },
      missingPercent: 22,
      duplicatePercent: 1,
      alerts: ["22% missing values overall", "142 potential outliers detected", "Duplicate records found"],
    },
  ],
  overallHealth: {
    totalDatasets: 5,
    healthyDatasets: 3,
    warningDatasets: 1,
    criticalDatasets: 1,
    averageScore: 82,
  },
};

export default function QualityDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  // In production, this would fetch from /api/quality/dashboard
  const {
    data: qualityData,
    isLoading,
    refetch,
  } = useQuery<QualityDashboardData>({
    queryKey: ["/api/quality/dashboard"],
    queryFn: async () => {
      // Return mock data for now - replace with actual fetch
      return mockQualityData;
    },
    staleTime: 60000, // 1 minute
  });

  const data = qualityData || mockQualityData;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8 max-w-5xl">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-ros-primary" />
              Data Quality Dashboard
            </h1>
            <p className="text-muted-foreground">
              Monitor data quality metrics and profiling reports
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="datasets" data-testid="tab-datasets">
              <Database className="h-4 w-4 mr-2" />
              Datasets
            </TabsTrigger>
            <TabsTrigger value="reports" data-testid="tab-reports">
              <FileText className="h-4 w-4 mr-2" />
              Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {isLoading ? (
              <LoadingSkeleton />
            ) : (
              <>
                <HealthOverviewCard health={data.overallHealth} />

                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Quality Dimensions</CardTitle>
                      <CardDescription>
                        Average scores across all datasets
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {[
                          { name: "Completeness", value: 86, desc: "Data fields populated" },
                          { name: "Validity", value: 95, desc: "Values within expected ranges" },
                          { name: "Uniqueness", value: 99, desc: "No duplicate records" },
                          { name: "Timeliness", value: 90, desc: "Data currency" },
                        ].map((dim) => (
                          <div key={dim.name}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">{dim.name}</span>
                              <span className={`text-sm font-bold ${getScoreColor(dim.value)}`}>
                                {dim.value}%
                              </span>
                            </div>
                            <Progress value={dim.value} className="h-2" />
                            <div className="text-xs text-muted-foreground mt-1">{dim.desc}</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Recent Activity</CardTitle>
                      <CardDescription>
                        Latest profiling and validation runs
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {data.recentReports.slice(0, 4).map((report) => (
                          <div
                            key={report.reportId}
                            className="flex items-center justify-between py-2 border-b last:border-0"
                          >
                            <div>
                              <div className="text-sm font-medium">{report.datasetName}</div>
                              <div className="text-xs text-muted-foreground">
                                Profiled {new Date(report.generatedAt).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {report.alerts.length > 0 && (
                                <Badge variant="outline" className="text-amber-600">
                                  {report.alerts.length} alerts
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="datasets" className="space-y-6">
            {isLoading ? (
              <LoadingSkeleton />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Dataset Quality Metrics</h2>
                  <Button variant="outline" size="sm">
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </div>

                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    {data.datasets.map((dataset) => (
                      <DatasetQualityCard key={dataset.datasetId} dataset={dataset} />
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            {isLoading ? (
              <LoadingSkeleton />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Profiling Reports</h2>
                  <Button variant="outline" size="sm">
                    Generate Report
                  </Button>
                </div>

                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    {data.recentReports.map((report) => (
                      <ReportCard key={report.reportId} report={report} />
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
