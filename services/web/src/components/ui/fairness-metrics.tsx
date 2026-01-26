import { useMemo } from "react";
import { safeFixed } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, Users, MapPin, Calendar } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend
} from "recharts";

interface DemographicGroup {
  name: string;
  count: number;
  percentage: number;
}

interface FairnessMetricsProps {
  totalRecords: number;
  ageGroups?: DemographicGroup[];
  genderDistribution?: DemographicGroup[];
  geographicRegions?: DemographicGroup[];
  ethnicityGroups?: DemographicGroup[];
  variant?: "default" | "compact";
}

const UNDERREPRESENTATION_THRESHOLD = 10; // 10% threshold for warnings

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function FairnessMetrics({
  totalRecords,
  ageGroups,
  genderDistribution,
  geographicRegions,
  ethnicityGroups,
  variant = "default"
}: FairnessMetricsProps) {
  
  const underrepresentedGroups = useMemo(() => {
    const issues: { category: string; group: string; percentage: number }[] = [];
    
    const checkGroups = (groups: DemographicGroup[] | undefined, category: string) => {
      if (!groups) return;
      groups.forEach(g => {
        if (g.percentage < UNDERREPRESENTATION_THRESHOLD && g.count > 0) {
          issues.push({ category, group: g.name, percentage: g.percentage });
        }
      });
    };
    
    checkGroups(ageGroups, "Age");
    checkGroups(genderDistribution, "Gender");
    checkGroups(geographicRegions, "Region");
    checkGroups(ethnicityGroups, "Ethnicity");
    
    return issues;
  }, [ageGroups, genderDistribution, geographicRegions, ethnicityGroups]);

  const hasWarnings = underrepresentedGroups.length > 0;

  if (variant === "compact") {
    return (
      <Card data-testid="card-fairness-metrics-compact">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Fairness Check
            </CardTitle>
            {hasWarnings ? (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {underrepresentedGroups.length} issues
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Balanced
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {hasWarnings 
              ? `${underrepresentedGroups.length} demographic group(s) below ${UNDERREPRESENTATION_THRESHOLD}% representation`
              : "All demographic groups adequately represented"
            }
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="section-fairness-metrics">
      {/* Warning Banner */}
      {hasWarnings && (
        <Alert className="bg-amber-500/10 border-amber-500/30" data-testid="alert-underrepresentation">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-600 dark:text-amber-400">
            Potential Representation Bias Detected
          </AlertTitle>
          <AlertDescription className="text-sm">
            <p className="mb-2">
              The following groups have less than {UNDERREPRESENTATION_THRESHOLD}% representation 
              in the dataset, which may affect generalizability of findings:
            </p>
            <div className="flex flex-wrap gap-2">
              {underrepresentedGroups.map((issue, idx) => (
                <Badge 
                  key={idx} 
                  variant="outline" 
                  className="bg-amber-500/10 border-amber-500/30"
                  data-testid={`badge-underrep-${issue.category.toLowerCase()}-${idx}`}
                >
                  {issue.category}: {issue.group} ({safeFixed(issue.percentage, 1)}%)
                </Badge>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Card */}
      <Card data-testid="card-fairness-summary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Demographic Distribution Analysis
          </CardTitle>
          <CardDescription data-testid="text-fairness-total-records">
            Fairness metrics for {totalRecords.toLocaleString()} records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Age Distribution */}
            {ageGroups && ageGroups.length > 0 && (
              <div data-testid="chart-age-distribution">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Age Distribution
                </h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ageGroups} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                      <Tooltip 
                        formatter={(value: number) => [`${safeFixed(value, 1)}%`, "Percentage"]}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))'
                        }}
                      />
                      <Bar dataKey="percentage" radius={[0, 4, 4, 0]}>
                        {ageGroups.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`}
                            fill={entry.percentage < UNDERREPRESENTATION_THRESHOLD 
                              ? "hsl(var(--destructive))" 
                              : CHART_COLORS[index % CHART_COLORS.length]
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Gender Distribution */}
            {genderDistribution && genderDistribution.length > 0 && (
              <div data-testid="chart-gender-distribution">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Gender Distribution
                </h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={genderDistribution}
                        dataKey="percentage"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={60}
                        label={({ name, percentage }) => `${name}: ${safeFixed(percentage, 1)}%`}
                        labelLine={false}
                      >
                        {genderDistribution.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`}
                            fill={entry.percentage < UNDERREPRESENTATION_THRESHOLD 
                              ? "hsl(var(--destructive))" 
                              : CHART_COLORS[index % CHART_COLORS.length]
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => [`${safeFixed(value, 1)}%`, "Percentage"]}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))'
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Geographic Distribution */}
            {geographicRegions && geographicRegions.length > 0 && (
              <div data-testid="chart-geographic-distribution">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Geographic Distribution
                </h4>
                <div className="space-y-2">
                  {geographicRegions.map((region, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className={region.percentage < UNDERREPRESENTATION_THRESHOLD ? "text-destructive" : ""}>
                          {region.name}
                        </span>
                        <span className="text-muted-foreground">
                          {region.count.toLocaleString()} ({safeFixed(region.percentage, 1)}%)
                        </span>
                      </div>
                      <Progress 
                        value={region.percentage} 
                        className={region.percentage < UNDERREPRESENTATION_THRESHOLD ? "bg-destructive/20" : ""}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ethnicity Distribution */}
            {ethnicityGroups && ethnicityGroups.length > 0 && (
              <div data-testid="chart-ethnicity-distribution">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Ethnicity Distribution
                </h4>
                <div className="space-y-2">
                  {ethnicityGroups.map((group, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className={group.percentage < UNDERREPRESENTATION_THRESHOLD ? "text-destructive" : ""}>
                          {group.name}
                          {group.percentage < UNDERREPRESENTATION_THRESHOLD && (
                            <AlertTriangle className="inline h-3 w-3 ml-1 text-amber-500" />
                          )}
                        </span>
                        <span className="text-muted-foreground">
                          {group.count.toLocaleString()} ({safeFixed(group.percentage, 1)}%)
                        </span>
                      </div>
                      <Progress 
                        value={group.percentage}
                        className={group.percentage < UNDERREPRESENTATION_THRESHOLD ? "bg-destructive/20" : ""}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
