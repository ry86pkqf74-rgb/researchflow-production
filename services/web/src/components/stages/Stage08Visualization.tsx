/**
 * Stage 08 - Visualization
 * Create figures and data visualizations
 * Features: Chart type gallery, data column mapping, styling options, preview panel, figure gallery, export options, AI recommendations
 */

import * as React from 'react';
import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  BarChart3,
  LineChart,
  ScatterChart,
  PieChart,
  Grid3X3,
  TrendingUp,
  BoxSelect,
  Layers,
  Palette,
  Settings,
  Download,
  FileImage,
  FileCode,
  FileText,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  RefreshCcw,
  Sparkles,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Move,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlertCircle,
  Info,
  Image,
  Upload,
  Save,
  Edit3,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ModelTierSelect, type ModelTier } from '@/components/ai';

// ==================== Types ====================

export type ChartType =
  | 'bar'
  | 'line'
  | 'scatter'
  | 'heatmap'
  | 'boxplot'
  | 'histogram'
  | 'pie';

export type ExportFormat = 'png' | 'svg' | 'pdf';

export type FigureStatus = 'draft' | 'generating' | 'ready' | 'error';

export interface DataColumn {
  id: string;
  name: string;
  type: 'numeric' | 'categorical' | 'datetime' | 'text';
  sampleValues: string[];
  min?: number;
  max?: number;
  uniqueCount?: number;
}

export interface AxisMapping {
  columnId: string | null;
  label?: string;
  scale?: 'linear' | 'log' | 'time';
  min?: number;
  max?: number;
}

export interface ColorConfig {
  primary: string;
  secondary: string;
  palette: string[];
  scheme: 'default' | 'viridis' | 'plasma' | 'blues' | 'greens' | 'custom';
}

export interface LegendConfig {
  show: boolean;
  position: 'top' | 'bottom' | 'left' | 'right';
  title?: string;
}

export interface ChartStyle {
  title: string;
  subtitle?: string;
  width: number;
  height: number;
  showGrid: boolean;
  showDataLabels: boolean;
  colors: ColorConfig;
  legend: LegendConfig;
  fontFamily: string;
  fontSize: number;
  backgroundColor: string;
}

export interface ChartConfig {
  id: string;
  name: string;
  chartType: ChartType;
  xAxis: AxisMapping;
  yAxis: AxisMapping;
  groupBy?: string | null;
  colorBy?: string | null;
  sizeBy?: string | null;
  aggregation?: 'none' | 'sum' | 'mean' | 'count' | 'median' | 'min' | 'max';
  style: ChartStyle;
}

export interface Figure {
  id: string;
  name: string;
  description?: string;
  config: ChartConfig;
  datasetId: string;
  status: FigureStatus;
  previewUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  exportedFormats: ExportFormat[];
  error?: string;
}

export interface AIRecommendation {
  id: string;
  chartType: ChartType;
  description: string;
  confidence: number;
  suggestedConfig: Partial<ChartConfig>;
  reasoning: string;
}

export interface DatasetInfo {
  id: string;
  name: string;
  columns: DataColumn[];
  rowCount: number;
}

interface Stage08Props {
  figures: Figure[];
  datasets: DatasetInfo[];
  onFiguresChange: (figures: Figure[]) => void;
  onCreateFigure?: (config: ChartConfig, datasetId: string) => Promise<Figure>;
  onUpdateFigure?: (figureId: string, config: ChartConfig) => Promise<Figure>;
  onDeleteFigure?: (figureId: string) => Promise<void>;
  onExportFigure?: (figureId: string, format: ExportFormat) => Promise<string>;
  onGeneratePreview?: (config: ChartConfig, datasetId: string) => Promise<string>;
  onGetAIRecommendations?: (datasetId: string, modelTier: ModelTier) => Promise<AIRecommendation[]>;
  className?: string;
}

// Chart type definitions
const CHART_TYPES: Record<ChartType, { name: string; icon: LucideIcon; description: string }> = {
  bar: {
    name: 'Bar Chart',
    icon: BarChart3,
    description: 'Compare values across categories',
  },
  line: {
    name: 'Line Chart',
    icon: LineChart,
    description: 'Show trends over time or continuous data',
  },
  scatter: {
    name: 'Scatter Plot',
    icon: ScatterChart,
    description: 'Explore relationships between two variables',
  },
  heatmap: {
    name: 'Heatmap',
    icon: Grid3X3,
    description: 'Visualize patterns in matrix data',
  },
  boxplot: {
    name: 'Box Plot',
    icon: BoxSelect,
    description: 'Show distribution and outliers',
  },
  histogram: {
    name: 'Histogram',
    icon: TrendingUp,
    description: 'Display frequency distribution',
  },
  pie: {
    name: 'Pie Chart',
    icon: PieChart,
    description: 'Show proportions of a whole',
  },
};

// Color schemes
const COLOR_SCHEMES: Record<ColorConfig['scheme'], { name: string; colors: string[] }> = {
  default: {
    name: 'Default',
    colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
  },
  viridis: {
    name: 'Viridis',
    colors: ['#440154', '#414487', '#2a788e', '#22a884', '#7ad151', '#fde725'],
  },
  plasma: {
    name: 'Plasma',
    colors: ['#0d0887', '#6a00a8', '#b12a90', '#e16462', '#fca636', '#f0f921'],
  },
  blues: {
    name: 'Blues',
    colors: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#2171b5'],
  },
  greens: {
    name: 'Greens',
    colors: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#238b45'],
  },
  custom: {
    name: 'Custom',
    colors: [],
  },
};

// Default chart style
const DEFAULT_STYLE: ChartStyle = {
  title: '',
  width: 800,
  height: 600,
  showGrid: true,
  showDataLabels: false,
  colors: {
    primary: '#3b82f6',
    secondary: '#10b981',
    palette: COLOR_SCHEMES.default.colors,
    scheme: 'default',
  },
  legend: {
    show: true,
    position: 'right',
  },
  fontFamily: 'Inter, sans-serif',
  fontSize: 12,
  backgroundColor: '#ffffff',
};

// Default chart config
const DEFAULT_CONFIG: Omit<ChartConfig, 'id' | 'name'> = {
  chartType: 'bar',
  xAxis: { columnId: null },
  yAxis: { columnId: null },
  groupBy: null,
  colorBy: null,
  sizeBy: null,
  aggregation: 'none',
  style: DEFAULT_STYLE,
};

// ==================== Main Component ====================

export function Stage08Visualization({
  figures,
  datasets,
  onFiguresChange,
  onCreateFigure,
  onUpdateFigure,
  onDeleteFigure,
  onExportFigure,
  onGeneratePreview,
  onGetAIRecommendations,
  className,
}: Stage08Props) {
  const [selectedTab, setSelectedTab] = useState('create');
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    datasets[0]?.id || null
  );
  const [selectedFigureId, setSelectedFigureId] = useState<string | null>(null);
  const [currentConfig, setCurrentConfig] = useState<ChartConfig>({
    id: '',
    name: 'New Figure',
    ...DEFAULT_CONFIG,
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [aiModelTier, setAiModelTier] = useState<ModelTier>('standard');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['chartType', 'dataMapping', 'styling'])
  );

  const selectedDataset = useMemo(
    () => datasets.find((d) => d.id === selectedDatasetId),
    [datasets, selectedDatasetId]
  );

  const selectedFigure = useMemo(
    () => figures.find((f) => f.id === selectedFigureId),
    [figures, selectedFigureId]
  );

  // Load figure config when selecting a figure
  useEffect(() => {
    if (selectedFigure) {
      setCurrentConfig(selectedFigure.config);
      setSelectedDatasetId(selectedFigure.datasetId);
      setPreviewUrl(selectedFigure.previewUrl || null);
    }
  }, [selectedFigure]);

  // Toggle section expansion
  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  // Update config
  const updateConfig = useCallback((updates: Partial<ChartConfig>) => {
    setCurrentConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  // Update style
  const updateStyle = useCallback((updates: Partial<ChartStyle>) => {
    setCurrentConfig((prev) => ({
      ...prev,
      style: { ...prev.style, ...updates },
    }));
  }, []);

  // Generate preview
  const handleGeneratePreview = useCallback(async () => {
    if (!onGeneratePreview || !selectedDatasetId) return;

    setIsGenerating(true);
    try {
      const url = await onGeneratePreview(currentConfig, selectedDatasetId);
      setPreviewUrl(url);
    } catch (error) {
      console.error('Failed to generate preview:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [onGeneratePreview, currentConfig, selectedDatasetId]);

  // Create figure
  const handleCreateFigure = useCallback(async () => {
    if (!onCreateFigure || !selectedDatasetId) return;

    setIsGenerating(true);
    try {
      const newFigure = await onCreateFigure(currentConfig, selectedDatasetId);
      onFiguresChange([...figures, newFigure]);
      setSelectedFigureId(newFigure.id);
      setSelectedTab('gallery');
    } finally {
      setIsGenerating(false);
    }
  }, [onCreateFigure, currentConfig, selectedDatasetId, figures, onFiguresChange]);

  // Update existing figure
  const handleUpdateFigure = useCallback(async () => {
    if (!onUpdateFigure || !selectedFigureId) return;

    setIsGenerating(true);
    try {
      const updatedFigure = await onUpdateFigure(selectedFigureId, currentConfig);
      onFiguresChange(
        figures.map((f) => (f.id === selectedFigureId ? updatedFigure : f))
      );
    } finally {
      setIsGenerating(false);
    }
  }, [onUpdateFigure, selectedFigureId, currentConfig, figures, onFiguresChange]);

  // Delete figure
  const handleDeleteFigure = useCallback(
    async (figureId: string) => {
      if (!onDeleteFigure) return;

      await onDeleteFigure(figureId);
      onFiguresChange(figures.filter((f) => f.id !== figureId));
      if (selectedFigureId === figureId) {
        setSelectedFigureId(null);
        setCurrentConfig({ id: '', name: 'New Figure', ...DEFAULT_CONFIG });
        setPreviewUrl(null);
      }
    },
    [onDeleteFigure, figures, onFiguresChange, selectedFigureId]
  );

  // Export figure
  const handleExportFigure = useCallback(
    async (figureId: string, format: ExportFormat) => {
      if (!onExportFigure) return;

      const url = await onExportFigure(figureId, format);
      // Trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `figure.${format}`;
      link.click();
    },
    [onExportFigure]
  );

  // Get AI recommendations
  const handleGetRecommendations = useCallback(async () => {
    if (!onGetAIRecommendations || !selectedDatasetId) return;

    setIsLoadingRecommendations(true);
    try {
      const recs = await onGetAIRecommendations(selectedDatasetId, aiModelTier);
      setRecommendations(recs);
    } catch (error) {
      console.error('Failed to get recommendations:', error);
    } finally {
      setIsLoadingRecommendations(false);
    }
  }, [onGetAIRecommendations, selectedDatasetId, aiModelTier]);

  // Apply recommendation
  const applyRecommendation = useCallback((rec: AIRecommendation) => {
    setCurrentConfig((prev) => ({
      ...prev,
      ...rec.suggestedConfig,
      chartType: rec.chartType,
    }));
  }, []);

  // Reset to new figure
  const handleNewFigure = useCallback(() => {
    setSelectedFigureId(null);
    setCurrentConfig({ id: '', name: 'New Figure', ...DEFAULT_CONFIG });
    setPreviewUrl(null);
    setSelectedTab('create');
  }, []);

  const numericColumns = useMemo(
    () => selectedDataset?.columns.filter((c) => c.type === 'numeric') || [],
    [selectedDataset]
  );

  const categoricalColumns = useMemo(
    () => selectedDataset?.columns.filter((c) => c.type === 'categorical') || [],
    [selectedDataset]
  );

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with dataset selection */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Data Visualization</CardTitle>
                <CardDescription>
                  Create publication-quality figures and charts
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="dataset-select" className="text-sm whitespace-nowrap">
                  Dataset:
                </Label>
                <Select
                  value={selectedDatasetId || ''}
                  onValueChange={setSelectedDatasetId}
                >
                  <SelectTrigger id="dataset-select" className="w-[200px]">
                    <SelectValue placeholder="Select dataset" />
                  </SelectTrigger>
                  <SelectContent>
                    {datasets.map((ds) => (
                      <SelectItem key={ds.id} value={ds.id}>
                        {ds.name} ({ds.rowCount.toLocaleString()} rows)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={handleNewFigure}>
                <Plus className="mr-2 h-4 w-4" />
                New Figure
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="create">
            <Edit3 className="mr-2 h-4 w-4" />
            Create
          </TabsTrigger>
          <TabsTrigger value="gallery">
            <Image className="mr-2 h-4 w-4" />
            Gallery ({figures.length})
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Sparkles className="mr-2 h-4 w-4" />
            AI Assist
          </TabsTrigger>
        </TabsList>

        {/* Create Tab */}
        <TabsContent value="create" className="mt-4">
          {selectedDataset ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Configuration Panel */}
              <div className="space-y-4">
                {/* Chart Type Selection */}
                <ConfigSection
                  title="Chart Type"
                  icon={BarChart3}
                  isExpanded={expandedSections.has('chartType')}
                  onToggle={() => toggleSection('chartType')}
                >
                  <ChartTypeGallery
                    selectedType={currentConfig.chartType}
                    onSelect={(type) => updateConfig({ chartType: type })}
                  />
                </ConfigSection>

                {/* Data Mapping */}
                <ConfigSection
                  title="Data Mapping"
                  icon={Layers}
                  isExpanded={expandedSections.has('dataMapping')}
                  onToggle={() => toggleSection('dataMapping')}
                >
                  <DataMappingPanel
                    config={currentConfig}
                    columns={selectedDataset.columns}
                    numericColumns={numericColumns}
                    categoricalColumns={categoricalColumns}
                    onUpdateConfig={updateConfig}
                  />
                </ConfigSection>

                {/* Styling Options */}
                <ConfigSection
                  title="Styling"
                  icon={Palette}
                  isExpanded={expandedSections.has('styling')}
                  onToggle={() => toggleSection('styling')}
                >
                  <StylingPanel
                    style={currentConfig.style}
                    onUpdateStyle={updateStyle}
                  />
                </ConfigSection>
              </div>

              {/* Preview Panel */}
              <div className="space-y-4">
                <Card className="sticky top-4">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Preview</CardTitle>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleGeneratePreview}
                          disabled={isGenerating || !currentConfig.xAxis.columnId}
                        >
                          {isGenerating ? (
                            <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Eye className="mr-2 h-4 w-4" />
                          )}
                          {isGenerating ? 'Generating...' : 'Refresh'}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <PreviewPanel
                      previewUrl={previewUrl}
                      isGenerating={isGenerating}
                      config={currentConfig}
                    />
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Input
                      value={currentConfig.name}
                      onChange={(e) => updateConfig({ name: e.target.value })}
                      placeholder="Figure name"
                      className="w-48"
                    />
                    <div className="flex gap-2">
                      {selectedFigureId ? (
                        <Button
                          onClick={handleUpdateFigure}
                          disabled={isGenerating}
                        >
                          <Save className="mr-2 h-4 w-4" />
                          Update Figure
                        </Button>
                      ) : (
                        <Button
                          onClick={handleCreateFigure}
                          disabled={
                            isGenerating || !currentConfig.xAxis.columnId || !currentConfig.name
                          }
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Create Figure
                        </Button>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  Please select a dataset to start creating visualizations
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Gallery Tab */}
        <TabsContent value="gallery" className="mt-4">
          <FigureGallery
            figures={figures}
            selectedFigureId={selectedFigureId}
            onSelectFigure={(id) => {
              setSelectedFigureId(id);
              setSelectedTab('create');
            }}
            onDeleteFigure={handleDeleteFigure}
            onExportFigure={handleExportFigure}
            onDuplicateFigure={(fig) => {
              setCurrentConfig({
                ...fig.config,
                id: '',
                name: `${fig.config.name} (Copy)`,
              });
              setSelectedDatasetId(fig.datasetId);
              setSelectedFigureId(null);
              setSelectedTab('create');
            }}
          />
        </TabsContent>

        {/* AI Assist Tab */}
        <TabsContent value="ai" className="mt-4">
          <AIRecommendationsPanel
            recommendations={recommendations}
            isLoading={isLoadingRecommendations}
            modelTier={aiModelTier}
            onModelTierChange={setAiModelTier}
            onGetRecommendations={handleGetRecommendations}
            onApplyRecommendation={(rec) => {
              applyRecommendation(rec);
              setSelectedTab('create');
            }}
            hasDataset={!!selectedDataset}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ==================== Sub-Components ====================

// Config Section Wrapper
interface ConfigSectionProps {
  title: string;
  icon: LucideIcon;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function ConfigSection({
  title,
  icon: Icon,
  isExpanded,
  onToggle,
  children,
}: ConfigSectionProps) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {title}
              </CardTitle>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// Chart Type Gallery
interface ChartTypeGalleryProps {
  selectedType: ChartType;
  onSelect: (type: ChartType) => void;
}

function ChartTypeGallery({ selectedType, onSelect }: ChartTypeGalleryProps) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
      {(Object.keys(CHART_TYPES) as ChartType[]).map((type) => {
        const { name, icon: Icon, description } = CHART_TYPES[type];
        const isSelected = selectedType === type;

        return (
          <TooltipProvider key={type}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onSelect(type)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-lg border transition-all',
                    isSelected
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                      : 'hover:border-primary/50 hover:bg-muted/50'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-8 w-8',
                      isSelected ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                  <span
                    className={cn(
                      'text-xs font-medium',
                      isSelected ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    {name}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}

// Data Mapping Panel
interface DataMappingPanelProps {
  config: ChartConfig;
  columns: DataColumn[];
  numericColumns: DataColumn[];
  categoricalColumns: DataColumn[];
  onUpdateConfig: (updates: Partial<ChartConfig>) => void;
}

function DataMappingPanel({
  config,
  columns,
  numericColumns,
  categoricalColumns,
  onUpdateConfig,
}: DataMappingPanelProps) {
  const requiresGroupBy = ['bar', 'line', 'boxplot'].includes(config.chartType);
  const supportsColorBy = ['scatter', 'bar', 'line'].includes(config.chartType);
  const supportsSizeBy = config.chartType === 'scatter';
  const supportsAggregation = ['bar', 'line', 'heatmap'].includes(config.chartType);

  return (
    <div className="space-y-4">
      {/* X-Axis */}
      <div className="space-y-2">
        <Label>X-Axis</Label>
        <Select
          value={config.xAxis.columnId || ''}
          onValueChange={(v) =>
            onUpdateConfig({ xAxis: { ...config.xAxis, columnId: v || null } })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select column" />
          </SelectTrigger>
          <SelectContent>
            {columns.map((col) => (
              <SelectItem key={col.id} value={col.id}>
                <span className="flex items-center gap-2">
                  {col.name}
                  <Badge variant="secondary" className="text-xs">
                    {col.type}
                  </Badge>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {config.xAxis.columnId && (
          <Input
            value={config.xAxis.label || ''}
            onChange={(e) =>
              onUpdateConfig({
                xAxis: { ...config.xAxis, label: e.target.value },
              })
            }
            placeholder="X-axis label (optional)"
            className="mt-2"
          />
        )}
      </div>

      {/* Y-Axis */}
      <div className="space-y-2">
        <Label>Y-Axis</Label>
        <Select
          value={config.yAxis.columnId || ''}
          onValueChange={(v) =>
            onUpdateConfig({ yAxis: { ...config.yAxis, columnId: v || null } })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select column" />
          </SelectTrigger>
          <SelectContent>
            {numericColumns.map((col) => (
              <SelectItem key={col.id} value={col.id}>
                <span className="flex items-center gap-2">
                  {col.name}
                  {col.min !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      ({col.min.toFixed(1)} - {col.max?.toFixed(1)})
                    </span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {config.yAxis.columnId && (
          <Input
            value={config.yAxis.label || ''}
            onChange={(e) =>
              onUpdateConfig({
                yAxis: { ...config.yAxis, label: e.target.value },
              })
            }
            placeholder="Y-axis label (optional)"
            className="mt-2"
          />
        )}
      </div>

      {/* Group By */}
      {requiresGroupBy && (
        <div className="space-y-2">
          <Label>Group By (optional)</Label>
          <Select
            value={config.groupBy || 'none'}
            onValueChange={(v) =>
              onUpdateConfig({ groupBy: v === 'none' ? null : v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {categoricalColumns.map((col) => (
                <SelectItem key={col.id} value={col.id}>
                  {col.name} ({col.uniqueCount} unique)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Color By */}
      {supportsColorBy && (
        <div className="space-y-2">
          <Label>Color By (optional)</Label>
          <Select
            value={config.colorBy || 'none'}
            onValueChange={(v) =>
              onUpdateConfig({ colorBy: v === 'none' ? null : v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {columns.map((col) => (
                <SelectItem key={col.id} value={col.id}>
                  {col.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Size By (scatter only) */}
      {supportsSizeBy && (
        <div className="space-y-2">
          <Label>Size By (optional)</Label>
          <Select
            value={config.sizeBy || 'none'}
            onValueChange={(v) =>
              onUpdateConfig({ sizeBy: v === 'none' ? null : v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {numericColumns.map((col) => (
                <SelectItem key={col.id} value={col.id}>
                  {col.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Aggregation */}
      {supportsAggregation && (
        <div className="space-y-2">
          <Label>Aggregation</Label>
          <Select
            value={config.aggregation || 'none'}
            onValueChange={(v) =>
              onUpdateConfig({
                aggregation: v as ChartConfig['aggregation'],
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (raw values)</SelectItem>
              <SelectItem value="sum">Sum</SelectItem>
              <SelectItem value="mean">Mean</SelectItem>
              <SelectItem value="median">Median</SelectItem>
              <SelectItem value="count">Count</SelectItem>
              <SelectItem value="min">Min</SelectItem>
              <SelectItem value="max">Max</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

// Styling Panel
interface StylingPanelProps {
  style: ChartStyle;
  onUpdateStyle: (updates: Partial<ChartStyle>) => void;
}

function StylingPanel({ style, onUpdateStyle }: StylingPanelProps) {
  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="space-y-2">
        <Label>Chart Title</Label>
        <Input
          value={style.title}
          onChange={(e) => onUpdateStyle({ title: e.target.value })}
          placeholder="Enter chart title"
        />
      </div>

      {/* Subtitle */}
      <div className="space-y-2">
        <Label>Subtitle (optional)</Label>
        <Input
          value={style.subtitle || ''}
          onChange={(e) => onUpdateStyle({ subtitle: e.target.value })}
          placeholder="Enter subtitle"
        />
      </div>

      <Separator />

      {/* Dimensions */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Width (px)</Label>
          <Input
            type="number"
            value={style.width}
            onChange={(e) => onUpdateStyle({ width: Number(e.target.value) })}
            min={200}
            max={2000}
          />
        </div>
        <div className="space-y-2">
          <Label>Height (px)</Label>
          <Input
            type="number"
            value={style.height}
            onChange={(e) => onUpdateStyle({ height: Number(e.target.value) })}
            min={200}
            max={2000}
          />
        </div>
      </div>

      <Separator />

      {/* Color Scheme */}
      <div className="space-y-2">
        <Label>Color Scheme</Label>
        <Select
          value={style.colors.scheme}
          onValueChange={(v) =>
            onUpdateStyle({
              colors: {
                ...style.colors,
                scheme: v as ColorConfig['scheme'],
                palette: COLOR_SCHEMES[v as ColorConfig['scheme']].colors,
              },
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(COLOR_SCHEMES).map(([key, scheme]) => (
              <SelectItem key={key} value={key}>
                <span className="flex items-center gap-2">
                  {scheme.name}
                  {scheme.colors.length > 0 && (
                    <span className="flex gap-0.5">
                      {scheme.colors.slice(0, 5).map((color, i) => (
                        <span
                          key={i}
                          className="w-3 h-3 rounded-sm"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Primary Color */}
      <div className="space-y-2">
        <Label>Primary Color</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={style.colors.primary}
            onChange={(e) =>
              onUpdateStyle({
                colors: { ...style.colors, primary: e.target.value },
              })
            }
            className="w-10 h-10 rounded border cursor-pointer"
          />
          <Input
            value={style.colors.primary}
            onChange={(e) =>
              onUpdateStyle({
                colors: { ...style.colors, primary: e.target.value },
              })
            }
            className="flex-1"
          />
        </div>
      </div>

      <Separator />

      {/* Display Options */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="show-grid">Show Grid</Label>
          <Switch
            id="show-grid"
            checked={style.showGrid}
            onCheckedChange={(checked) => onUpdateStyle({ showGrid: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="show-labels">Show Data Labels</Label>
          <Switch
            id="show-labels"
            checked={style.showDataLabels}
            onCheckedChange={(checked) =>
              onUpdateStyle({ showDataLabels: checked })
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="show-legend">Show Legend</Label>
          <Switch
            id="show-legend"
            checked={style.legend.show}
            onCheckedChange={(checked) =>
              onUpdateStyle({ legend: { ...style.legend, show: checked } })
            }
          />
        </div>

        {style.legend.show && (
          <div className="space-y-2">
            <Label>Legend Position</Label>
            <Select
              value={style.legend.position}
              onValueChange={(v) =>
                onUpdateStyle({
                  legend: {
                    ...style.legend,
                    position: v as LegendConfig['position'],
                  },
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top">Top</SelectItem>
                <SelectItem value="bottom">Bottom</SelectItem>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Separator />

      {/* Font Settings */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Font Family</Label>
          <Select
            value={style.fontFamily}
            onValueChange={(v) => onUpdateStyle({ fontFamily: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Inter, sans-serif">Inter</SelectItem>
              <SelectItem value="Arial, sans-serif">Arial</SelectItem>
              <SelectItem value="Helvetica, sans-serif">Helvetica</SelectItem>
              <SelectItem value="Georgia, serif">Georgia</SelectItem>
              <SelectItem value="Times New Roman, serif">Times New Roman</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Font Size</Label>
          <Input
            type="number"
            value={style.fontSize}
            onChange={(e) => onUpdateStyle({ fontSize: Number(e.target.value) })}
            min={8}
            max={24}
          />
        </div>
      </div>
    </div>
  );
}

// Preview Panel
interface PreviewPanelProps {
  previewUrl: string | null;
  isGenerating: boolean;
  config: ChartConfig;
}

function PreviewPanel({ previewUrl, isGenerating, config }: PreviewPanelProps) {
  const chartInfo = CHART_TYPES[config.chartType];

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] bg-muted/30 rounded-lg">
        <RefreshCcw className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Generating preview...</p>
      </div>
    );
  }

  if (!previewUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] bg-muted/30 rounded-lg border-2 border-dashed">
        <chartInfo.icon className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground font-medium">{chartInfo.name}</p>
        <p className="text-sm text-muted-foreground mt-2">
          Configure data mapping and click &quot;Refresh&quot; to preview
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <img
        src={previewUrl}
        alt="Chart preview"
        className="w-full h-auto rounded-lg border"
        style={{ maxHeight: '500px', objectFit: 'contain' }}
      />
      <div className="absolute top-2 right-2 flex gap-1">
        <Button size="icon" variant="secondary" className="h-8 w-8">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="secondary" className="h-8 w-8">
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Figure Gallery
interface FigureGalleryProps {
  figures: Figure[];
  selectedFigureId: string | null;
  onSelectFigure: (id: string) => void;
  onDeleteFigure: (id: string) => void;
  onExportFigure: (id: string, format: ExportFormat) => void;
  onDuplicateFigure: (figure: Figure) => void;
}

function FigureGallery({
  figures,
  selectedFigureId,
  onSelectFigure,
  onDeleteFigure,
  onExportFigure,
  onDuplicateFigure,
}: FigureGalleryProps) {
  if (figures.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Image className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground font-medium">No figures yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            Create your first visualization in the Create tab
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {figures.map((figure) => {
        const chartInfo = CHART_TYPES[figure.config.chartType];
        const ChartIcon = chartInfo.icon;

        return (
          <Card
            key={figure.id}
            className={cn(
              'cursor-pointer transition-all hover:shadow-md',
              selectedFigureId === figure.id && 'ring-2 ring-primary'
            )}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ChartIcon className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm">{figure.name}</CardTitle>
                </div>
                <FigureStatusBadge status={figure.status} />
              </div>
              {figure.description && (
                <CardDescription className="text-xs">
                  {figure.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="pb-2">
              {figure.previewUrl ? (
                <img
                  src={figure.previewUrl}
                  alt={figure.name}
                  className="w-full h-32 object-cover rounded border"
                  onClick={() => onSelectFigure(figure.id)}
                />
              ) : (
                <div
                  className="w-full h-32 bg-muted/50 rounded border flex items-center justify-center"
                  onClick={() => onSelectFigure(figure.id)}
                >
                  <ChartIcon className="h-12 w-12 text-muted-foreground/30" />
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                {figure.updatedAt.toLocaleDateString()}
              </span>
              <div className="flex gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => onSelectFigure(figure.id)}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => onDuplicateFigure(figure)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Duplicate</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <ExportMenu
                  onExport={(format) => onExportFigure(figure.id, format)}
                />

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => onDeleteFigure(figure.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}

// Figure Status Badge
function FigureStatusBadge({ status }: { status: FigureStatus }) {
  const config: Record<
    FigureStatus,
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
  > = {
    draft: { label: 'Draft', variant: 'secondary' },
    generating: { label: 'Generating', variant: 'default' },
    ready: { label: 'Ready', variant: 'outline' },
    error: { label: 'Error', variant: 'destructive' },
  };

  const { label, variant } = config[status];

  return (
    <Badge variant={variant} className="text-xs">
      {status === 'generating' && (
        <RefreshCcw className="mr-1 h-3 w-3 animate-spin" />
      )}
      {label}
    </Badge>
  );
}

// Export Menu
function ExportMenu({
  onExport,
}: {
  onExport: (format: ExportFormat) => void;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7">
          <Download className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[300px]">
        <DialogHeader>
          <DialogTitle>Export Figure</DialogTitle>
          <DialogDescription>Choose an export format</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-4">
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => onExport('png')}
          >
            <FileImage className="mr-2 h-4 w-4" />
            PNG (Raster Image)
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => onExport('svg')}
          >
            <FileCode className="mr-2 h-4 w-4" />
            SVG (Vector Image)
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => onExport('pdf')}
          >
            <FileText className="mr-2 h-4 w-4" />
            PDF (Document)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// AI Recommendations Panel
interface AIRecommendationsPanelProps {
  recommendations: AIRecommendation[];
  isLoading: boolean;
  modelTier: ModelTier;
  onModelTierChange: (tier: ModelTier) => void;
  onGetRecommendations: () => void;
  onApplyRecommendation: (rec: AIRecommendation) => void;
  hasDataset: boolean;
}

function AIRecommendationsPanel({
  recommendations,
  isLoading,
  modelTier,
  onModelTierChange,
  onGetRecommendations,
  onApplyRecommendation,
  hasDataset,
}: AIRecommendationsPanelProps) {
  return (
    <div className="space-y-6">
      {/* AI Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Chart Recommendations
          </CardTitle>
          <CardDescription>
            Get intelligent suggestions for the best visualizations based on your data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label className="mb-2 block">Model Tier</Label>
              <ModelTierSelect value={modelTier} onChange={onModelTierChange} />
            </div>
            <Button
              onClick={onGetRecommendations}
              disabled={isLoading || !hasDataset}
              className="mt-6"
            >
              {isLoading ? (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Get Recommendations
                </>
              )}
            </Button>
          </div>

          {!hasDataset && (
            <p className="text-sm text-muted-foreground">
              Please select a dataset to get AI recommendations
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recommendations List */}
      {recommendations.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-medium">Suggested Visualizations</h3>
          {recommendations.map((rec) => {
            const chartInfo = CHART_TYPES[rec.chartType];
            const ChartIcon = chartInfo.icon;

            return (
              <Card key={rec.id}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <ChartIcon className="h-8 w-8 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{chartInfo.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {Math.round(rec.confidence * 100)}% match
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {rec.description}
                      </p>
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 px-2">
                            <Info className="mr-1 h-3 w-3" />
                            Why this chart?
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <p className="text-xs text-muted-foreground mt-2 p-2 bg-muted/50 rounded">
                            {rec.reasoning}
                          </p>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onApplyRecommendation(rec)}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Apply
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {recommendations.length === 0 && !isLoading && hasDataset && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Sparkles className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              Click &quot;Get Recommendations&quot; to analyze your data
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default Stage08Visualization;
