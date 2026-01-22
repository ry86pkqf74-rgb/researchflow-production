import * as React from "react";
import { safeFixed, formatBytes } from "@/lib/format";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface HistogramChartProps {
  data: Array<{ bin: string; count: number }>;
  title: string;
  xLabel?: string;
  yLabel?: string;
}

interface CorrelationHeatmapProps {
  data: Array<{ variable1: string; variable2: string; correlation: number }>;
  variables: string[];
}

interface BoxPlotChartProps {
  data: Array<{
    category: string;
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
    outliers?: number[];
  }>;
  title: string;
}

interface SummaryChartsSectionProps {
  ageDistribution?: Array<{ bin: string; count: number }>;
  boxPlotData?: Array<{
    category: string;
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
    outliers?: number[];
  }>;
  correlationData?: Array<{ variable1: string; variable2: string; correlation: number }>;
  correlationVariables?: string[];
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm shadow-xl">
        <p className="font-medium text-foreground">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-muted-foreground">
            {entry.name}: <span className="font-mono font-medium text-foreground">{entry.value.toLocaleString()}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function HistogramChart({ data, title, xLabel, yLabel }: HistogramChartProps) {
  return (
    <Card data-testid="chart-histogram">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full" data-testid="histogram-container">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis
                dataKey="bin"
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
                label={xLabel ? { value: xLabel, position: "bottom", offset: 0, className: "fill-muted-foreground text-xs" } : undefined}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
                label={yLabel ? { value: yLabel, angle: -90, position: "insideLeft", className: "fill-muted-foreground text-xs" } : undefined}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="count"
                name="Count"
                fill="hsl(var(--chart-1))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function getCorrelationColor(value: number): string {
  if (value < 0) {
    const intensity = Math.abs(value);
    return `hsl(5, ${Math.round(70 * intensity)}%, ${Math.round(55 + 45 * (1 - intensity))}%)`;
  } else if (value > 0) {
    const intensity = value;
    return `hsl(145, ${Math.round(63 * intensity)}%, ${Math.round(42 + 48 * (1 - intensity))}%)`;
  }
  return "hsl(0, 0%, 95%)";
}

export function CorrelationHeatmap({ data, variables }: CorrelationHeatmapProps) {
  const [hoveredCell, setHoveredCell] = React.useState<{ row: string; col: string; value: number } | null>(null);

  const getCorrelation = (var1: string, var2: string): number => {
    if (var1 === var2) return 1;
    const found = data.find(
      (d) => (d.variable1 === var1 && d.variable2 === var2) || (d.variable1 === var2 && d.variable2 === var1)
    );
    return found?.correlation ?? 0;
  };

  return (
    <Card data-testid="chart-correlation-heatmap">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Correlation Matrix</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative" data-testid="heatmap-container">
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              <div className="flex">
                <div className="w-20 shrink-0" />
                {variables.map((variable) => (
                  <div
                    key={`header-${variable}`}
                    className="flex h-8 w-12 shrink-0 items-end justify-center pb-1"
                  >
                    <span className="origin-bottom-left rotate-[-45deg] whitespace-nowrap text-xs text-muted-foreground">
                      {variable.length > 8 ? `${variable.slice(0, 8)}...` : variable}
                    </span>
                  </div>
                ))}
              </div>
              {variables.map((rowVar) => (
                <div key={`row-${rowVar}`} className="flex">
                  <div className="flex w-20 shrink-0 items-center justify-end pr-2">
                    <span className="truncate text-xs text-muted-foreground" title={rowVar}>
                      {rowVar.length > 10 ? `${rowVar.slice(0, 10)}...` : rowVar}
                    </span>
                  </div>
                  {variables.map((colVar) => {
                    const correlation = getCorrelation(rowVar, colVar);
                    const isHovered = hoveredCell?.row === rowVar && hoveredCell?.col === colVar;
                    return (
                      <div
                        key={`cell-${rowVar}-${colVar}`}
                        className={cn(
                          "relative h-12 w-12 shrink-0 cursor-pointer border border-background transition-all",
                          isHovered && "ring-2 ring-primary ring-offset-1"
                        )}
                        style={{ backgroundColor: getCorrelationColor(correlation) }}
                        onMouseEnter={() => setHoveredCell({ row: rowVar, col: colVar, value: correlation })}
                        onMouseLeave={() => setHoveredCell(null)}
                        data-testid={`heatmap-cell-${rowVar}-${colVar}`}
                      >
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                          {safeFixed(correlation, 2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          {hoveredCell && (
            <div
              className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm shadow-xl"
              data-testid="heatmap-tooltip"
            >
              <p className="font-medium text-foreground">
                {hoveredCell.row} × {hoveredCell.col}
              </p>
              <p className="text-muted-foreground">
                Correlation: <span className="font-mono font-medium text-foreground">{hoveredCell.safeFixed(value, 3)}</span>
              </p>
            </div>
          )}
          <div className="mt-4 flex items-center justify-center gap-2" data-testid="heatmap-legend">
            <span className="text-xs text-muted-foreground">-1</span>
            <div className="flex h-4 w-40 rounded-sm overflow-hidden">
              <div className="h-full flex-1" style={{ background: "linear-gradient(to right, hsl(5, 70%, 55%), hsl(0, 0%, 95%))" }} />
              <div className="h-full flex-1" style={{ background: "linear-gradient(to right, hsl(0, 0%, 95%), hsl(145, 63%, 42%))" }} />
            </div>
            <span className="text-xs text-muted-foreground">+1</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface BoxPlotShapeProps {
  x: number;
  y: number;
  width: number;
  payload: {
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
    category: string;
    outliers?: number[];
  };
  yAxisScale: (value: number) => number;
}

const BoxPlotShape: React.FC<BoxPlotShapeProps> = ({ x, width, payload, yAxisScale }) => {
  const { min, q1, median, q3, max, outliers = [] } = payload;
  const boxWidth = Math.max(width * 0.6, 20);
  const boxX = x + (width - boxWidth) / 2;
  const whiskerWidth = boxWidth * 0.5;
  const whiskerX = x + (width - whiskerWidth) / 2;

  const minY = yAxisScale(min);
  const q1Y = yAxisScale(q1);
  const medianY = yAxisScale(median);
  const q3Y = yAxisScale(q3);
  const maxY = yAxisScale(max);

  return (
    <g>
      <line
        x1={x + width / 2}
        y1={maxY}
        x2={x + width / 2}
        y2={q3Y}
        stroke="hsl(var(--chart-1))"
        strokeWidth={1.5}
      />
      <line
        x1={whiskerX}
        y1={maxY}
        x2={whiskerX + whiskerWidth}
        y2={maxY}
        stroke="hsl(var(--chart-1))"
        strokeWidth={1.5}
      />
      <rect
        x={boxX}
        y={q3Y}
        width={boxWidth}
        height={q1Y - q3Y}
        fill="hsl(var(--chart-1))"
        fillOpacity={0.3}
        stroke="hsl(var(--chart-1))"
        strokeWidth={1.5}
        rx={2}
      />
      <line
        x1={boxX}
        y1={medianY}
        x2={boxX + boxWidth}
        y2={medianY}
        stroke="hsl(var(--chart-2))"
        strokeWidth={2}
      />
      <line
        x1={x + width / 2}
        y1={q1Y}
        x2={x + width / 2}
        y2={minY}
        stroke="hsl(var(--chart-1))"
        strokeWidth={1.5}
      />
      <line
        x1={whiskerX}
        y1={minY}
        x2={whiskerX + whiskerWidth}
        y2={minY}
        stroke="hsl(var(--chart-1))"
        strokeWidth={1.5}
      />
      {outliers.map((outlier, idx) => (
        <circle
          key={idx}
          cx={x + width / 2}
          cy={yAxisScale(outlier)}
          r={3}
          fill="hsl(var(--chart-4))"
          stroke="hsl(var(--chart-4))"
          strokeWidth={1}
        />
      ))}
    </g>
  );
};

const BoxPlotTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: BoxPlotChartProps["data"][0] }>;
}) => {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm shadow-xl">
        <p className="font-medium text-foreground">{data.category}</p>
        <div className="mt-1 space-y-0.5 text-muted-foreground">
          <p>Max: <span className="font-mono font-medium text-foreground">{data.safeFixed(max, 2)}</span></p>
          <p>Q3: <span className="font-mono font-medium text-foreground">{data.safeFixed(q3, 2)}</span></p>
          <p>Median: <span className="font-mono font-medium text-foreground">{data.safeFixed(median, 2)}</span></p>
          <p>Q1: <span className="font-mono font-medium text-foreground">{data.safeFixed(q1, 2)}</span></p>
          <p>Min: <span className="font-mono font-medium text-foreground">{data.safeFixed(min, 2)}</span></p>
          {data.outliers && data.outliers.length > 0 && (
            <p>Outliers: <span className="font-mono font-medium text-foreground">{data.outliers.length}</span></p>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export function BoxPlotChart({ data, title }: BoxPlotChartProps) {
  const allValues = data.flatMap((d) => [d.min, d.q1, d.median, d.q3, d.max, ...(d.outliers || [])]);
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const padding = (maxValue - minValue) * 0.1;
  const yDomain = [minValue - padding, maxValue + padding];

  const [chartDimensions, setChartDimensions] = React.useState({ height: 0, marginTop: 20, marginBottom: 30 });
  const chartRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (chartRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setChartDimensions((prev) => ({
            ...prev,
            height: entry.contentRect.height,
          }));
        }
      });
      resizeObserver.observe(chartRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  const createYScale = (value: number) => {
    const usableHeight = chartDimensions.height - chartDimensions.marginTop - chartDimensions.marginBottom;
    const range = yDomain[1] - yDomain[0];
    const normalized = (value - yDomain[0]) / range;
    return chartDimensions.marginTop + usableHeight * (1 - normalized);
  };

  return (
    <Card data-testid="chart-boxplot">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={chartRef} className="h-64 w-full" data-testid="boxplot-container">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis
                dataKey="category"
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
              />
              <YAxis
                domain={yDomain}
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
              />
              <Tooltip content={<BoxPlotTooltip />} />
              <Bar
                dataKey="max"
                shape={(props: any) => (
                  <BoxPlotShape
                    x={props.x}
                    y={props.y}
                    width={props.width}
                    payload={props.payload}
                    yAxisScale={createYScale}
                  />
                )}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground" data-testid="boxplot-legend">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-sm bg-[hsl(var(--chart-1))] opacity-30" />
            <span>IQR (Q1-Q3)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-0.5 w-4 bg-[hsl(var(--chart-2))]" />
            <span>Median</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-0.5 bg-[hsl(var(--chart-1))]" />
            <span>Whiskers</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-[hsl(var(--chart-4))]" />
            <span>Outliers</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SummaryChartsSection({
  ageDistribution,
  boxPlotData,
  correlationData,
  correlationVariables,
}: SummaryChartsSectionProps) {
  const hasAgeDistribution = ageDistribution && ageDistribution.length > 0;
  const hasBoxPlotData = boxPlotData && boxPlotData.length > 0;
  const hasCorrelationData = correlationData && correlationData.length > 0 && correlationVariables && correlationVariables.length > 0;

  if (!hasAgeDistribution && !hasBoxPlotData && !hasCorrelationData) {
    return (
      <div className="text-center text-muted-foreground py-8" data-testid="summary-charts-empty">
        No chart data available
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="summary-charts-section">
      <div className="grid gap-6 md:grid-cols-2">
        {hasAgeDistribution && (
          <HistogramChart
            data={ageDistribution}
            title="Age Distribution"
            xLabel="Age Range"
            yLabel="Count"
          />
        )}
        {hasBoxPlotData && (
          <BoxPlotChart
            data={boxPlotData}
            title="Numeric Variables by Group"
          />
        )}
      </div>
      {hasCorrelationData && (
        <CorrelationHeatmap
          data={correlationData}
          variables={correlationVariables}
        />
      )}
    </div>
  );
}

export type {
  HistogramChartProps,
  CorrelationHeatmapProps,
  BoxPlotChartProps,
  SummaryChartsSectionProps,
};
