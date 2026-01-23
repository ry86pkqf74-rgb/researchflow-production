/**
 * Stage 18 - Impact Assessment
 * Evaluate and track research impact metrics
 * Features: Citation metrics dashboard (h-index contribution, citation count, field-weighted citation impact),
 *           Altmetrics integration (social media mentions, news coverage, policy citations),
 *           Download/usage statistics, Impact narrative editor for grant reporting,
 *           Visualization of impact over time, Comparison with field averages,
 *           AI assistance for generating impact summaries and narratives,
 *           Export impact report functionality
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  TrendingUp,
  Quote,
  Share2,
  FileText,
  Download,
  BarChart3,
  LineChart,
  PieChart,
  ArrowUp,
  ArrowDown,
  Minus,
  RefreshCcw,
  Calendar,
  ExternalLink,
  Globe,
  Twitter,
  Newspaper,
  Building2,
  Users,
  BookOpen,
  Award,
  Target,
  Sparkles,
  Copy,
  Check,
  Edit3,
  Save,
  X,
  Plus,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  Info,
  AlertCircle,
  Clock,
  Eye,
  FileDown,
  Loader2,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
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
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { StageLayout, type StageState } from './StageLayout';

// ==================== Types ====================

export type MetricTrend = 'up' | 'down' | 'stable';

export type CitationSource = 'scopus' | 'wos' | 'google_scholar' | 'crossref' | 'pubmed' | 'manual';

export type AltmetricSource = 'twitter' | 'facebook' | 'news' | 'blogs' | 'wikipedia' | 'policy' | 'patents' | 'reddit' | 'mendeley' | 'other';

export type ImpactCategory = 'academic' | 'societal' | 'economic' | 'policy' | 'educational';

export type TimeRange = '7d' | '30d' | '90d' | '1y' | 'all';

export type ExportFormat = 'json' | 'csv' | 'pdf' | 'docx';

export interface CitationMetric {
  id: string;
  source: CitationSource;
  totalCitations: number;
  hIndexContribution: number;
  fieldWeightedCitationImpact: number;
  selfCitations: number;
  lastUpdated: Date;
  trend: MetricTrend;
  trendPercentage: number;
}

export interface CitationRecord {
  id: string;
  source: CitationSource;
  citingArticleTitle: string;
  citingArticleAuthors: string[];
  citingArticleDoi?: string;
  citingArticleJournal?: string;
  citationDate: Date;
  citationContext?: string;
  isSelfCitation: boolean;
  url?: string;
}

export interface AltmetricScore {
  id: string;
  source: AltmetricSource;
  count: number;
  lastUpdated: Date;
  trend: MetricTrend;
  trendPercentage: number;
  url?: string;
}

export interface AltmetricMention {
  id: string;
  source: AltmetricSource;
  title: string;
  author?: string;
  url: string;
  date: Date;
  reach?: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  excerpt?: string;
}

export interface UsageStatistic {
  id: string;
  metricType: 'downloads' | 'views' | 'shares' | 'saves';
  platform: string;
  count: number;
  uniqueUsers?: number;
  lastUpdated: Date;
  trend: MetricTrend;
  trendPercentage: number;
}

export interface TimeSeriesDataPoint {
  date: Date;
  value: number;
}

export interface ImpactTimeSeries {
  metricName: string;
  dataPoints: TimeSeriesDataPoint[];
  aggregationType: 'cumulative' | 'periodic';
}

export interface FieldComparison {
  metricName: string;
  yourValue: number;
  fieldAverage: number;
  fieldMedian: number;
  percentile: number;
  fieldName: string;
}

export interface ImpactNarrative {
  id: string;
  title: string;
  category: ImpactCategory;
  content: string;
  evidenceRefs: string[];
  createdAt: Date;
  updatedAt: Date;
  isAiGenerated: boolean;
}

export interface ImpactReport {
  id: string;
  title: string;
  generatedAt: Date;
  timeRange: TimeRange;
  citationSummary: {
    totalCitations: number;
    hIndexContribution: number;
    avgFieldWeightedImpact: number;
  };
  altmetricSummary: {
    totalScore: number;
    topSources: Array<{ source: AltmetricSource; count: number }>;
  };
  usageSummary: {
    totalDownloads: number;
    totalViews: number;
  };
  narratives: ImpactNarrative[];
  fieldComparisons: FieldComparison[];
}

export interface ImpactAssessmentState {
  citationMetrics: CitationMetric[];
  citations: CitationRecord[];
  altmetricScores: AltmetricScore[];
  altmetricMentions: AltmetricMention[];
  usageStatistics: UsageStatistic[];
  timeSeries: ImpactTimeSeries[];
  fieldComparisons: FieldComparison[];
  narratives: ImpactNarrative[];
  report?: ImpactReport;
}

// Stage component props interface following the StageComponentProps pattern
export interface StageComponentProps {
  topicId: string;
  researchId: string;
  stageData?: ImpactAssessmentState;
  onComplete?: (data: ImpactAssessmentState) => void;
  onSave?: (data: ImpactAssessmentState) => void;
  isReadOnly?: boolean;
}

interface Stage18Props extends StageComponentProps {
  citationMetrics: CitationMetric[];
  citations: CitationRecord[];
  altmetricScores: AltmetricScore[];
  altmetricMentions: AltmetricMention[];
  usageStatistics: UsageStatistic[];
  timeSeries: ImpactTimeSeries[];
  fieldComparisons: FieldComparison[];
  narratives: ImpactNarrative[];
  report?: ImpactReport;
  onCitationMetricsChange: (metrics: CitationMetric[]) => void;
  onCitationsChange: (citations: CitationRecord[]) => void;
  onAltmetricScoresChange: (scores: AltmetricScore[]) => void;
  onAltmetricMentionsChange: (mentions: AltmetricMention[]) => void;
  onUsageStatisticsChange: (stats: UsageStatistic[]) => void;
  onTimeSeriesChange: (series: ImpactTimeSeries[]) => void;
  onFieldComparisonsChange: (comparisons: FieldComparison[]) => void;
  onNarrativesChange: (narratives: ImpactNarrative[]) => void;
  onRefreshMetrics?: (source?: CitationSource | AltmetricSource) => Promise<void>;
  onGenerateNarrative?: (category: ImpactCategory) => Promise<ImpactNarrative>;
  onGenerateReport?: (timeRange: TimeRange) => Promise<ImpactReport>;
  onExportReport?: (format: ExportFormat) => Promise<void>;
  isProcessing?: boolean;
  className?: string;
}

// ==================== Configuration ====================

const CITATION_SOURCE_CONFIG: Record<CitationSource, {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = {
  scopus: {
    label: 'Scopus',
    description: 'Elsevier Scopus citation database',
    icon: BookOpen,
    color: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  wos: {
    label: 'Web of Science',
    description: 'Clarivate Web of Science',
    icon: Globe,
    color: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  google_scholar: {
    label: 'Google Scholar',
    description: 'Google Scholar citations',
    icon: Search,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  crossref: {
    label: 'Crossref',
    description: 'Crossref DOI citations',
    icon: Share2,
    color: 'bg-green-100 text-green-700 border-green-200',
  },
  pubmed: {
    label: 'PubMed',
    description: 'PubMed Central citations',
    icon: Building2,
    color: 'bg-red-100 text-red-700 border-red-200',
  },
  manual: {
    label: 'Manual',
    description: 'Manually added citations',
    icon: Edit3,
    color: 'bg-gray-100 text-gray-700 border-gray-200',
  },
};

const ALTMETRIC_SOURCE_CONFIG: Record<AltmetricSource, {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = {
  twitter: {
    label: 'Twitter/X',
    description: 'Twitter/X mentions',
    icon: Twitter,
    color: 'bg-sky-100 text-sky-700 border-sky-200',
  },
  facebook: {
    label: 'Facebook',
    description: 'Facebook shares and mentions',
    icon: Users,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  news: {
    label: 'News',
    description: 'News media coverage',
    icon: Newspaper,
    color: 'bg-red-100 text-red-700 border-red-200',
  },
  blogs: {
    label: 'Blogs',
    description: 'Blog posts and articles',
    icon: FileText,
    color: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  wikipedia: {
    label: 'Wikipedia',
    description: 'Wikipedia references',
    icon: BookOpen,
    color: 'bg-gray-100 text-gray-700 border-gray-200',
  },
  policy: {
    label: 'Policy',
    description: 'Policy document citations',
    icon: Building2,
    color: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  patents: {
    label: 'Patents',
    description: 'Patent citations',
    icon: Award,
    color: 'bg-green-100 text-green-700 border-green-200',
  },
  reddit: {
    label: 'Reddit',
    description: 'Reddit discussions',
    icon: Users,
    color: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  mendeley: {
    label: 'Mendeley',
    description: 'Mendeley readers',
    icon: BookOpen,
    color: 'bg-red-100 text-red-700 border-red-200',
  },
  other: {
    label: 'Other',
    description: 'Other sources',
    icon: Globe,
    color: 'bg-gray-100 text-gray-500 border-gray-200',
  },
};

const IMPACT_CATEGORY_CONFIG: Record<ImpactCategory, {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = {
  academic: {
    label: 'Academic Impact',
    description: 'Citations, publications, and scholarly influence',
    icon: BookOpen,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  societal: {
    label: 'Societal Impact',
    description: 'Public engagement and social benefit',
    icon: Users,
    color: 'bg-green-100 text-green-700 border-green-200',
  },
  economic: {
    label: 'Economic Impact',
    description: 'Commercial applications and economic value',
    icon: TrendingUp,
    color: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  policy: {
    label: 'Policy Impact',
    description: 'Influence on policy and regulations',
    icon: Building2,
    color: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  educational: {
    label: 'Educational Impact',
    description: 'Teaching and training applications',
    icon: Award,
    color: 'bg-teal-100 text-teal-700 border-teal-200',
  },
};

const TIME_RANGE_OPTIONS: Array<{ value: TimeRange; label: string }> = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last year' },
  { value: 'all', label: 'All time' },
];

// ==================== Helper Components ====================

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  trend?: MetricTrend;
  trendValue?: number;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
}

function MetricCard({ title, value, subtitle, trend, trendValue, icon: Icon, color = 'bg-primary/10' }: MetricCardProps) {
  const TrendIcon = trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500';

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={cn('p-2 rounded-lg', color)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {trend && trendValue !== undefined && (
          <div className={cn('flex items-center gap-1 mt-2 text-sm', trendColor)}>
            <TrendIcon className="h-3 w-3" />
            <span>{Math.abs(trendValue)}%</span>
            <span className="text-muted-foreground">vs last period</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SimpleBarChartProps {
  data: Array<{ label: string; value: number; color?: string }>;
  maxValue?: number;
  className?: string;
}

function SimpleBarChart({ data, maxValue, className }: SimpleBarChartProps) {
  const max = maxValue || Math.max(...data.map(d => d.value), 1);

  return (
    <div className={cn('space-y-2', className)}>
      {data.map((item, index) => (
        <div key={index} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-medium">{item.value.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', item.color || 'bg-primary')}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

interface SimpleLineChartProps {
  data: TimeSeriesDataPoint[];
  className?: string;
  height?: number;
}

function SimpleLineChart({ data, className, height = 120 }: SimpleLineChartProps) {
  if (data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center text-muted-foreground', className)} style={{ height }}>
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const minValue = Math.min(...data.map(d => d.value), 0);
  const range = maxValue - minValue || 1;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1 || 1)) * 100;
    const y = 100 - ((d.value - minValue) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className={cn('relative', className)} style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <polyline
          points={points}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="absolute bottom-0 left-0 text-xs text-muted-foreground">
        {data[0]?.date.toLocaleDateString()}
      </div>
      <div className="absolute bottom-0 right-0 text-xs text-muted-foreground">
        {data[data.length - 1]?.date.toLocaleDateString()}
      </div>
    </div>
  );
}

// ==================== Main Component ====================

export function Stage18ImpactAssessment({
  topicId,
  researchId,
  stageData,
  onComplete,
  onSave,
  isReadOnly = false,
  citationMetrics,
  citations,
  altmetricScores,
  altmetricMentions,
  usageStatistics,
  timeSeries,
  fieldComparisons,
  narratives,
  report,
  onCitationMetricsChange,
  onCitationsChange,
  onAltmetricScoresChange,
  onAltmetricMentionsChange,
  onUsageStatisticsChange,
  onTimeSeriesChange,
  onFieldComparisonsChange,
  onNarrativesChange,
  onRefreshMetrics,
  onGenerateNarrative,
  onGenerateReport,
  onExportReport,
  isProcessing = false,
  className,
}: Stage18Props) {
  const [selectedTab, setSelectedTab] = useState('metrics');
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('1y');
  const [citationSourceFilter, setCitationSourceFilter] = useState<CitationSource | 'all'>('all');
  const [altmetricSourceFilter, setAltmetricSourceFilter] = useState<AltmetricSource | 'all'>('all');
  const [editingNarrativeId, setEditingNarrativeId] = useState<string | null>(null);
  const [editedNarrativeContent, setEditedNarrativeContent] = useState('');
  const [isGeneratingNarrative, setIsGeneratingNarrative] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [addNarrativeDialogOpen, setAddNarrativeDialogOpen] = useState(false);
  const [newNarrativeCategory, setNewNarrativeCategory] = useState<ImpactCategory>('academic');
  const [newNarrativeTitle, setNewNarrativeTitle] = useState('');
  const [copiedMetricId, setCopiedMetricId] = useState<string | null>(null);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalCitations = citationMetrics.reduce((sum, m) => sum + m.totalCitations, 0);
    const avgHIndex = citationMetrics.length > 0
      ? citationMetrics.reduce((sum, m) => sum + m.hIndexContribution, 0) / citationMetrics.length
      : 0;
    const avgFwci = citationMetrics.length > 0
      ? citationMetrics.reduce((sum, m) => sum + m.fieldWeightedCitationImpact, 0) / citationMetrics.length
      : 0;
    const totalAltmetric = altmetricScores.reduce((sum, s) => sum + s.count, 0);
    const totalDownloads = usageStatistics
      .filter(s => s.metricType === 'downloads')
      .reduce((sum, s) => sum + s.count, 0);
    const totalViews = usageStatistics
      .filter(s => s.metricType === 'views')
      .reduce((sum, s) => sum + s.count, 0);

    return {
      totalCitations,
      avgHIndex: avgHIndex.toFixed(1),
      avgFwci: avgFwci.toFixed(2),
      totalAltmetric,
      totalDownloads,
      totalViews,
    };
  }, [citationMetrics, altmetricScores, usageStatistics]);

  // Filter citations by source
  const filteredCitations = useMemo(() => {
    if (citationSourceFilter === 'all') return citations;
    return citations.filter(c => c.source === citationSourceFilter);
  }, [citations, citationSourceFilter]);

  // Filter altmetric mentions by source
  const filteredMentions = useMemo(() => {
    if (altmetricSourceFilter === 'all') return altmetricMentions;
    return altmetricMentions.filter(m => m.source === altmetricSourceFilter);
  }, [altmetricMentions, altmetricSourceFilter]);

  // Group altmetric scores by category
  const altmetricsByCategory = useMemo(() => {
    const social: AltmetricScore[] = [];
    const media: AltmetricScore[] = [];
    const scholarly: AltmetricScore[] = [];

    altmetricScores.forEach(score => {
      if (['twitter', 'facebook', 'reddit'].includes(score.source)) {
        social.push(score);
      } else if (['news', 'blogs', 'wikipedia'].includes(score.source)) {
        media.push(score);
      } else {
        scholarly.push(score);
      }
    });

    return { social, media, scholarly };
  }, [altmetricScores]);

  // Handle narrative editing
  const startEditingNarrative = useCallback((narrative: ImpactNarrative) => {
    setEditingNarrativeId(narrative.id);
    setEditedNarrativeContent(narrative.content);
  }, []);

  const saveNarrativeEdit = useCallback(() => {
    if (!editingNarrativeId) return;

    const updatedNarratives = narratives.map(n =>
      n.id === editingNarrativeId
        ? { ...n, content: editedNarrativeContent, updatedAt: new Date(), isAiGenerated: false }
        : n
    );
    onNarrativesChange(updatedNarratives);
    setEditingNarrativeId(null);
    setEditedNarrativeContent('');
  }, [editingNarrativeId, editedNarrativeContent, narratives, onNarrativesChange]);

  const cancelNarrativeEdit = useCallback(() => {
    setEditingNarrativeId(null);
    setEditedNarrativeContent('');
  }, []);

  // Handle AI narrative generation
  const handleGenerateNarrative = useCallback(async (category: ImpactCategory) => {
    if (!onGenerateNarrative) return;

    setIsGeneratingNarrative(true);
    try {
      const newNarrative = await onGenerateNarrative(category);
      onNarrativesChange([...narratives, newNarrative]);
    } finally {
      setIsGeneratingNarrative(false);
    }
  }, [onGenerateNarrative, narratives, onNarrativesChange]);

  // Handle adding new narrative manually
  const handleAddNarrative = useCallback(() => {
    const newNarrative: ImpactNarrative = {
      id: `narrative-${Date.now()}`,
      title: newNarrativeTitle || `${IMPACT_CATEGORY_CONFIG[newNarrativeCategory].label} Narrative`,
      category: newNarrativeCategory,
      content: '',
      evidenceRefs: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      isAiGenerated: false,
    };

    onNarrativesChange([...narratives, newNarrative]);
    setAddNarrativeDialogOpen(false);
    setNewNarrativeTitle('');
    setNewNarrativeCategory('academic');
    startEditingNarrative(newNarrative);
  }, [newNarrativeTitle, newNarrativeCategory, narratives, onNarrativesChange, startEditingNarrative]);

  // Handle deleting narrative
  const handleDeleteNarrative = useCallback((narrativeId: string) => {
    onNarrativesChange(narratives.filter(n => n.id !== narrativeId));
  }, [narratives, onNarrativesChange]);

  // Handle report generation
  const handleGenerateReport = useCallback(async () => {
    if (!onGenerateReport) return;

    setIsGeneratingReport(true);
    try {
      await onGenerateReport(selectedTimeRange);
    } finally {
      setIsGeneratingReport(false);
    }
  }, [onGenerateReport, selectedTimeRange]);

  // Handle export
  const handleExport = useCallback(async (format: ExportFormat) => {
    if (!onExportReport) return;

    setIsExporting(true);
    try {
      await onExportReport(format);
    } finally {
      setIsExporting(false);
    }
  }, [onExportReport]);

  // Copy metric to clipboard
  const copyMetricToClipboard = useCallback((metricId: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedMetricId(metricId);
    setTimeout(() => setCopiedMetricId(null), 2000);
  }, []);

  // Format number with K/M suffix
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          title="Total Citations"
          value={formatNumber(summaryStats.totalCitations)}
          icon={Quote}
          color="bg-blue-100"
          trend="up"
          trendValue={12}
        />
        <MetricCard
          title="h-Index Contribution"
          value={summaryStats.avgHIndex}
          icon={TrendingUp}
          color="bg-green-100"
        />
        <MetricCard
          title="Field-Weighted Impact"
          value={summaryStats.avgFwci}
          subtitle="FWCI"
          icon={Target}
          color="bg-purple-100"
        />
        <MetricCard
          title="Altmetric Score"
          value={formatNumber(summaryStats.totalAltmetric)}
          icon={Share2}
          color="bg-orange-100"
          trend="up"
          trendValue={8}
        />
        <MetricCard
          title="Downloads"
          value={formatNumber(summaryStats.totalDownloads)}
          icon={Download}
          color="bg-teal-100"
          trend="stable"
          trendValue={2}
        />
        <MetricCard
          title="Views"
          value={formatNumber(summaryStats.totalViews)}
          icon={Eye}
          color="bg-pink-100"
          trend="up"
          trendValue={15}
        />
      </div>

      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedTimeRange} onValueChange={(v) => setSelectedTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGE_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {onRefreshMetrics && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRefreshMetrics()}
              disabled={isProcessing}
            >
              <RefreshCcw className={cn('h-4 w-4 mr-2', isProcessing && 'animate-spin')} />
              Refresh
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateReport}
            disabled={isGeneratingReport || isProcessing}
          >
            {isGeneratingReport ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            Generate Report
          </Button>
          <Select onValueChange={(v) => handleExport(v as ExportFormat)} disabled={isExporting}>
            <SelectTrigger className="w-32">
              <FileDown className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Export" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="docx">Word</SelectItem>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="metrics" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Metrics
          </TabsTrigger>
          <TabsTrigger value="citations" className="gap-2">
            <Quote className="h-4 w-4" />
            Citations
          </TabsTrigger>
          <TabsTrigger value="altmetrics" className="gap-2">
            <Share2 className="h-4 w-4" />
            Altmetrics
          </TabsTrigger>
          <TabsTrigger value="narrative" className="gap-2">
            <FileText className="h-4 w-4" />
            Narrative
          </TabsTrigger>
        </TabsList>

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Citation Metrics by Source */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Citation Metrics by Source</CardTitle>
                <CardDescription>Track citations across different databases</CardDescription>
              </CardHeader>
              <CardContent>
                <SimpleBarChart
                  data={citationMetrics.map(m => ({
                    label: CITATION_SOURCE_CONFIG[m.source].label,
                    value: m.totalCitations,
                    color: 'bg-blue-500',
                  }))}
                />
              </CardContent>
            </Card>

            {/* Field Comparison */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Field Comparison</CardTitle>
                <CardDescription>Your metrics vs field averages</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {fieldComparisons.map((comparison, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{comparison.metricName}</span>
                      <Badge variant={comparison.percentile >= 75 ? 'default' : comparison.percentile >= 50 ? 'secondary' : 'outline'}>
                        {comparison.percentile}th percentile
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 text-xs text-muted-foreground">
                      <div>
                        <span className="block font-medium text-foreground">{comparison.yourValue.toFixed(2)}</span>
                        Your value
                      </div>
                      <div>
                        <span className="block font-medium text-foreground">{comparison.fieldAverage.toFixed(2)}</span>
                        Field avg
                      </div>
                      <div>
                        <span className="block font-medium text-foreground">{comparison.fieldMedian.toFixed(2)}</span>
                        Field median
                      </div>
                    </div>
                    <Progress value={comparison.percentile} className="h-2" />
                  </div>
                ))}
                {fieldComparisons.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No field comparison data available
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Impact Over Time */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Impact Over Time</CardTitle>
                <CardDescription>Cumulative citation growth</CardDescription>
              </CardHeader>
              <CardContent>
                {timeSeries.length > 0 ? (
                  <div className="space-y-4">
                    {timeSeries.map((series, index) => (
                      <div key={index} className="space-y-2">
                        <Label>{series.metricName}</Label>
                        <SimpleLineChart data={series.dataPoints} height={100} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-40 text-muted-foreground">
                    <div className="text-center">
                      <LineChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No time series data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Usage Statistics */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Usage Statistics</CardTitle>
                <CardDescription>Downloads, views, and engagement</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Platform</TableHead>
                      <TableHead>Metric Type</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Unique Users</TableHead>
                      <TableHead className="text-right">Trend</TableHead>
                      <TableHead className="text-right">Last Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usageStatistics.map((stat) => {
                      const TrendIcon = stat.trend === 'up' ? ArrowUp : stat.trend === 'down' ? ArrowDown : Minus;
                      const trendColor = stat.trend === 'up' ? 'text-green-600' : stat.trend === 'down' ? 'text-red-600' : 'text-gray-500';

                      return (
                        <TableRow key={stat.id}>
                          <TableCell className="font-medium">{stat.platform}</TableCell>
                          <TableCell className="capitalize">{stat.metricType}</TableCell>
                          <TableCell className="text-right">{stat.count.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            {stat.uniqueUsers?.toLocaleString() || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={cn('flex items-center justify-end gap-1', trendColor)}>
                              <TrendIcon className="h-3 w-3" />
                              {stat.trendPercentage}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {stat.lastUpdated.toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {usageStatistics.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No usage statistics available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Citations Tab */}
        <TabsContent value="citations" className="space-y-6">
          {/* Citation Metrics Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {citationMetrics.map((metric) => {
              const config = CITATION_SOURCE_CONFIG[metric.source];
              const SourceIcon = config.icon;

              return (
                <Card key={metric.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={config.color}>
                          <SourceIcon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyMetricToClipboard(metric.id, metric.totalCitations.toString())}
                            >
                              {copiedMetricId === metric.id ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Copy citation count</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-2xl font-bold">{metric.totalCitations.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Total Citations</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{metric.hIndexContribution}</p>
                        <p className="text-xs text-muted-foreground">h-Index Contrib.</p>
                      </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-medium">{metric.fieldWeightedCitationImpact.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">FWCI</p>
                      </div>
                      <div>
                        <p className="font-medium">{metric.selfCitations}</p>
                        <p className="text-xs text-muted-foreground">Self-citations</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Updated: {metric.lastUpdated.toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Citation List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Citation Records</CardTitle>
                  <CardDescription>Individual citing articles</CardDescription>
                </div>
                <Select
                  value={citationSourceFilter}
                  onValueChange={(v) => setCitationSourceFilter(v as CitationSource | 'all')}
                >
                  <SelectTrigger className="w-40">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    {Object.entries(CITATION_SOURCE_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {filteredCitations.map((citation) => {
                    const config = CITATION_SOURCE_CONFIG[citation.source];

                    return (
                      <div
                        key={citation.id}
                        className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className={cn('text-xs', config.color)}>
                                {config.label}
                              </Badge>
                              {citation.isSelfCitation && (
                                <Badge variant="secondary" className="text-xs">
                                  Self-citation
                                </Badge>
                              )}
                            </div>
                            <p className="font-medium text-sm line-clamp-2">
                              {citation.citingArticleTitle}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {citation.citingArticleAuthors.slice(0, 3).join(', ')}
                              {citation.citingArticleAuthors.length > 3 && ' et al.'}
                            </p>
                            {citation.citingArticleJournal && (
                              <p className="text-xs text-muted-foreground italic">
                                {citation.citingArticleJournal}
                              </p>
                            )}
                            {citation.citationContext && (
                              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                "{citation.citationContext}"
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <p className="text-xs text-muted-foreground">
                              {citation.citationDate.toLocaleDateString()}
                            </p>
                            {citation.url && (
                              <Button variant="ghost" size="sm" asChild>
                                <a href={citation.url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filteredCitations.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      <Quote className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No citations found</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Altmetrics Tab */}
        <TabsContent value="altmetrics" className="space-y-6">
          {/* Altmetric Score Summary */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Social Media
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SimpleBarChart
                  data={altmetricsByCategory.social.map(s => ({
                    label: ALTMETRIC_SOURCE_CONFIG[s.source].label,
                    value: s.count,
                    color: 'bg-sky-500',
                  }))}
                />
                {altmetricsByCategory.social.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No social media mentions</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Newspaper className="h-4 w-4" />
                  Media Coverage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SimpleBarChart
                  data={altmetricsByCategory.media.map(s => ({
                    label: ALTMETRIC_SOURCE_CONFIG[s.source].label,
                    value: s.count,
                    color: 'bg-red-500',
                  }))}
                />
                {altmetricsByCategory.media.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No media coverage</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Scholarly & Policy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SimpleBarChart
                  data={altmetricsByCategory.scholarly.map(s => ({
                    label: ALTMETRIC_SOURCE_CONFIG[s.source].label,
                    value: s.count,
                    color: 'bg-amber-500',
                  }))}
                />
                {altmetricsByCategory.scholarly.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No scholarly mentions</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Altmetric Mentions List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Mentions & Coverage</CardTitle>
                  <CardDescription>Individual altmetric mentions</CardDescription>
                </div>
                <Select
                  value={altmetricSourceFilter}
                  onValueChange={(v) => setAltmetricSourceFilter(v as AltmetricSource | 'all')}
                >
                  <SelectTrigger className="w-40">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    {Object.entries(ALTMETRIC_SOURCE_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {filteredMentions.map((mention) => {
                    const config = ALTMETRIC_SOURCE_CONFIG[mention.source];
                    const SourceIcon = config.icon;
                    const sentimentColor = mention.sentiment === 'positive' ? 'text-green-600' :
                      mention.sentiment === 'negative' ? 'text-red-600' : 'text-gray-500';

                    return (
                      <div
                        key={mention.id}
                        className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className={cn('text-xs', config.color)}>
                                <SourceIcon className="h-3 w-3 mr-1" />
                                {config.label}
                              </Badge>
                              {mention.sentiment && (
                                <span className={cn('text-xs', sentimentColor)}>
                                  {mention.sentiment}
                                </span>
                              )}
                              {mention.reach && (
                                <span className="text-xs text-muted-foreground">
                                  Reach: {formatNumber(mention.reach)}
                                </span>
                              )}
                            </div>
                            <p className="font-medium text-sm line-clamp-2">
                              {mention.title}
                            </p>
                            {mention.author && (
                              <p className="text-xs text-muted-foreground mt-1">
                                by {mention.author}
                              </p>
                            )}
                            {mention.excerpt && (
                              <p className="text-xs text-muted-foreground mt-2 line-clamp-2 italic">
                                "{mention.excerpt}"
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <p className="text-xs text-muted-foreground">
                              {mention.date.toLocaleDateString()}
                            </p>
                            <Button variant="ghost" size="sm" asChild>
                              <a href={mention.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filteredMentions.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      <Share2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No altmetric mentions found</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Narrative Tab */}
        <TabsContent value="narrative" className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Impact Narratives for Grant Reporting</AlertTitle>
            <AlertDescription>
              Create compelling impact narratives to demonstrate the value and reach of your research.
              Use AI assistance to generate drafts based on your metrics data.
            </AlertDescription>
          </Alert>

          {/* Narrative Actions */}
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setAddNarrativeDialogOpen(true)}
              disabled={isReadOnly}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Narrative
            </Button>

            {onGenerateNarrative && (
              <Select
                onValueChange={(v) => handleGenerateNarrative(v as ImpactCategory)}
                disabled={isGeneratingNarrative || isReadOnly}
              >
                <SelectTrigger className="w-48">
                  {isGeneratingNarrative ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  <SelectValue placeholder="Generate with AI" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(IMPACT_CATEGORY_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Narratives List */}
          <div className="space-y-4">
            {narratives.map((narrative) => {
              const config = IMPACT_CATEGORY_CONFIG[narrative.category];
              const CategoryIcon = config.icon;
              const isEditing = editingNarrativeId === narrative.id;

              return (
                <Card key={narrative.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={config.color}>
                          <CategoryIcon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                        {narrative.isAiGenerated && (
                          <Badge variant="secondary" className="text-xs">
                            <Sparkles className="h-3 w-3 mr-1" />
                            AI Generated
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {!isReadOnly && (
                          <>
                            {isEditing ? (
                              <>
                                <Button variant="ghost" size="sm" onClick={saveNarrativeEdit}>
                                  <Save className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={cancelNarrativeEdit}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => startEditingNarrative(narrative)}
                                >
                                  <Edit3 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteNarrative(narrative.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <CardTitle className="text-lg">{narrative.title}</CardTitle>
                    <CardDescription>
                      Last updated: {narrative.updatedAt.toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isEditing ? (
                      <Textarea
                        value={editedNarrativeContent}
                        onChange={(e) => setEditedNarrativeContent(e.target.value)}
                        className="min-h-40"
                        placeholder="Write your impact narrative here..."
                      />
                    ) : (
                      <div className="prose prose-sm max-w-none">
                        {narrative.content || (
                          <p className="text-muted-foreground italic">
                            No content yet. Click edit to add your narrative.
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                  {narrative.evidenceRefs.length > 0 && (
                    <CardFooter className="border-t pt-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        <span>Evidence: {narrative.evidenceRefs.length} references</span>
                      </div>
                    </CardFooter>
                  )}
                </Card>
              );
            })}

            {narratives.length === 0 && (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">No impact narratives yet</p>
                    <p className="text-sm mb-4">
                      Create narratives to document and communicate the impact of your research
                    </p>
                    <Button onClick={() => setAddNarrativeDialogOpen(true)} disabled={isReadOnly}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Narrative
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Narrative Dialog */}
      <Dialog open={addNarrativeDialogOpen} onOpenChange={setAddNarrativeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Impact Narrative</DialogTitle>
            <DialogDescription>
              Create a new impact narrative to document your research's influence
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={newNarrativeTitle}
                onChange={(e) => setNewNarrativeTitle(e.target.value)}
                placeholder="e.g., Academic Impact Summary"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={newNarrativeCategory}
                onValueChange={(v) => setNewNarrativeCategory(v as ImpactCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(IMPACT_CATEGORY_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <config.icon className="h-4 w-4" />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {IMPACT_CATEGORY_CONFIG[newNarrativeCategory].description}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddNarrativeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddNarrative}>
              Create Narrative
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Stage18ImpactAssessment;
