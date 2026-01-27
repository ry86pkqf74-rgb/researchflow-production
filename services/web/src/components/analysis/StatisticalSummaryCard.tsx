/**
 * Statistical Summary Card Component
 *
 * A compact card for displaying key statistical metrics with
 * visual indicators for significance and effect sizes.
 */

import * as React from "react";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface StatisticItem {
  label: string;
  value: number | string;
  unit?: string;
  description?: string;
  significance?: "significant" | "not-significant" | "marginal";
  trend?: "up" | "down" | "neutral";
  highlight?: boolean;
}

interface StatisticalSummaryCardProps {
  title: string;
  description?: string;
  statistics: StatisticItem[];
  pValue?: number;
  effectSize?: {
    value: number;
    name: string;
    interpretation?: "small" | "medium" | "large";
  };
  testName?: string;
  className?: string;
}

// Effect size interpretation thresholds (Cohen's conventions)
const getEffectSizeInterpretation = (name: string, value: number): "small" | "medium" | "large" => {
  const absValue = Math.abs(value);

  // Cohen's d
  if (name.toLowerCase().includes("cohen") || name.toLowerCase() === "d") {
    if (absValue < 0.2) return "small";
    if (absValue < 0.8) return "medium";
    return "large";
  }

  // Eta-squared
  if (name.toLowerCase().includes("eta")) {
    if (absValue < 0.01) return "small";
    if (absValue < 0.06) return "medium";
    return "large";
  }

  // Correlation (r)
  if (name.toLowerCase() === "r" || name.toLowerCase().includes("corr")) {
    if (absValue < 0.3) return "small";
    if (absValue < 0.5) return "medium";
    return "large";
  }

  // Odds ratio / Hazard ratio
  if (name.toLowerCase().includes("odds") || name.toLowerCase().includes("hazard") || name.toLowerCase() === "or" || name.toLowerCase() === "hr") {
    const logOR = Math.abs(Math.log(value));
    if (logOR < 0.5) return "small";
    if (logOR < 1.0) return "medium";
    return "large";
  }

  // Default
  if (absValue < 0.2) return "small";
  if (absValue < 0.5) return "medium";
  return "large";
};

const effectSizeColors = {
  small: "bg-gray-100 text-gray-700 border-gray-300",
  medium: "bg-blue-100 text-blue-700 border-blue-300",
  large: "bg-green-100 text-green-700 border-green-300",
};

const formatValue = (value: number | string, decimals = 3): string => {
  if (typeof value === "string") return value;
  if (isNaN(value)) return "—";
  if (Math.abs(value) < 0.001 && value !== 0) return value.toExponential(2);
  return value.toFixed(decimals);
};

const formatPValue = (p: number): string => {
  if (p < 0.001) return "< 0.001";
  return p.toFixed(3);
};

export function StatisticalSummaryCard({
  title,
  description,
  statistics,
  pValue,
  effectSize,
  testName,
  className,
}: StatisticalSummaryCardProps) {
  const isSignificant = pValue !== undefined && pValue < 0.05;
  const effectInterpretation = effectSize
    ? effectSize.interpretation || getEffectSizeInterpretation(effectSize.name, effectSize.value)
    : undefined;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {title}
              {isSignificant !== undefined && (
                isSignificant ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-gray-400" />
                )
              )}
            </CardTitle>
            {description && (
              <CardDescription className="text-xs mt-1">{description}</CardDescription>
            )}
          </div>
          {testName && (
            <Badge variant="outline" className="text-xs">
              {testName}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main Statistics Grid */}
        <div className="grid grid-cols-2 gap-3">
          {statistics.map((stat, idx) => (
            <div
              key={idx}
              className={cn(
                "p-3 rounded-lg",
                stat.highlight ? "bg-blue-50 border border-blue-200" : "bg-gray-50"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{stat.label}</span>
                {stat.trend && (
                  <span>
                    {stat.trend === "up" && <TrendingUp className="h-3 w-3 text-green-500" />}
                    {stat.trend === "down" && <TrendingDown className="h-3 w-3 text-red-500" />}
                    {stat.trend === "neutral" && <Minus className="h-3 w-3 text-gray-400" />}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span
                  className={cn(
                    "text-lg font-semibold",
                    stat.significance === "significant" && "text-green-700",
                    stat.significance === "not-significant" && "text-gray-600",
                    stat.significance === "marginal" && "text-amber-600"
                  )}
                >
                  {formatValue(stat.value)}
                </span>
                {stat.unit && <span className="text-xs text-gray-400">{stat.unit}</span>}
              </div>
              {stat.description && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-gray-400 mt-1" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-xs">{stat.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          ))}
        </div>

        {/* P-value and Effect Size Row */}
        {(pValue !== undefined || effectSize) && (
          <div className="flex items-center justify-between pt-2 border-t">
            {pValue !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">p-value:</span>
                <span
                  className={cn(
                    "font-mono text-sm font-semibold",
                    pValue < 0.001 && "text-green-600",
                    pValue >= 0.001 && pValue < 0.05 && "text-green-500",
                    pValue >= 0.05 && pValue < 0.1 && "text-amber-500",
                    pValue >= 0.1 && "text-gray-500"
                  )}
                >
                  {formatPValue(pValue)}
                </span>
                {pValue < 0.001 && <Badge className="bg-green-100 text-green-700 text-xs">***</Badge>}
                {pValue >= 0.001 && pValue < 0.01 && (
                  <Badge className="bg-green-100 text-green-700 text-xs">**</Badge>
                )}
                {pValue >= 0.01 && pValue < 0.05 && (
                  <Badge className="bg-yellow-100 text-yellow-700 text-xs">*</Badge>
                )}
              </div>
            )}

            {effectSize && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">{effectSize.name}:</span>
                <span className="font-mono text-sm font-semibold">
                  {formatValue(effectSize.value)}
                </span>
                {effectInterpretation && (
                  <Badge
                    variant="outline"
                    className={cn("text-xs", effectSizeColors[effectInterpretation])}
                  >
                    {effectInterpretation}
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        {/* Significance Interpretation */}
        {pValue !== undefined && (
          <div
            className={cn(
              "text-xs p-2 rounded",
              isSignificant ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-600"
            )}
          >
            {isSignificant ? (
              <>
                <CheckCircle className="h-3 w-3 inline mr-1" />
                Statistically significant at α = 0.05
              </>
            ) : (
              <>
                <Info className="h-3 w-3 inline mr-1" />
                Not statistically significant at α = 0.05
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default StatisticalSummaryCard;
