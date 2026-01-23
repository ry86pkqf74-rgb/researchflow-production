/**
 * ExtractionConfigPanel Component
 * 
 * Configuration panel for clinical data extraction:
 * - Model tier selection
 * - PHI scanning options
 * - Column selection
 * - NLM enrichment toggle
 * - Cost estimation
 */

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import {
  Settings,
  Zap,
  Brain,
  Sparkles,
  Shield,
  DollarSign,
  Info,
  AlertTriangle,
  CheckCircle2,
  Table,
  BookOpen,
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
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// Types
export type ExtractionTier = 'NANO' | 'MINI' | 'FRONTIER';

export interface ColumnInfo {
  name: string;
  isNarrative: boolean;
  sampleValue?: string;
  rowCount: number;
  avgLength?: number;
}

export interface ExtractionConfig {
  tier: ExtractionTier;
  columns: string[];
  enablePhiScanning: boolean;
  blockOnPhi: boolean;
  enableNlmEnrichment: boolean;
  minTextLength: number;
  maxConcurrent: number;
  outputFormat: 'json' | 'parquet' | 'csv';
}

export interface CostEstimate {
  estimatedCells: number;
  estimatedTokens: number;
  estimatedCostUsd: number;
  estimatedTimeSeconds: number;
}

export interface ExtractionConfigPanelProps {
  columns: ColumnInfo[];
  config: ExtractionConfig;
  onConfigChange: (config: ExtractionConfig) => void;
  onStartExtraction: () => void;
  costEstimate?: CostEstimate;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

// Tier configuration
const TIER_CONFIG = {
  NANO: {
    name: 'NANO',
    description: 'Fast extraction for simple notes',
    icon: Zap,
    color: 'text-green-500',
    costMultiplier: 1,
    qualityLabel: 'Good',
    speedLabel: 'Fast',
    features: ['Basic extraction', 'Low cost', 'Quick processing'],
    recommended: false,
  },
  MINI: {
    name: 'MINI',
    description: 'Balanced performance for most notes',
    icon: Brain,
    color: 'text-blue-500',
    costMultiplier: 3,
    qualityLabel: 'Better',
    speedLabel: 'Moderate',
    features: ['Evidence tracking', 'Confidence scores', 'Recommended for most use cases'],
    recommended: true,
  },
  FRONTIER: {
    name: 'FRONTIER',
    description: 'Maximum accuracy for complex notes',
    icon: Sparkles,
    color: 'text-purple-500',
    costMultiplier: 10,
    qualityLabel: 'Best',
    speedLabel: 'Slower',
    features: ['Clavien-Dindo classification', 'Detailed study fields', 'Highest accuracy'],
    recommended: false,
  },
};

// Tier selector component
const TierSelector: React.FC<{
  value: ExtractionTier;
  onChange: (tier: ExtractionTier) => void;
}> = ({ value, onChange }) => {
  return (
    <div className="grid grid-cols-3 gap-3">
      {(Object.keys(TIER_CONFIG) as ExtractionTier[]).map((tier) => {
        const config = TIER_CONFIG[tier];
        const Icon = config.icon;
        const isSelected = value === tier;
        
        return (
          <button
            key={tier}
            onClick={() => onChange(tier)}
            className={cn(
              'relative p-3 border rounded-lg text-left transition-all',
              isSelected
                ? 'border-primary bg-primary/5 ring-2 ring-primary'
                : 'border-muted hover:border-primary/50 hover:bg-muted/50'
            )}
          >
            {config.recommended && (
              <Badge className="absolute -top-2 -right-2 text-xs">
                Recommended
              </Badge>
            )}
            <div className="flex items-center gap-2 mb-2">
              <Icon className={cn('h-5 w-5', config.color)} />
              <span className="font-medium">{config.name}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              {config.description}
            </p>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-xs">
                {config.qualityLabel}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {config.speedLabel}
              </Badge>
            </div>
          </button>
        );
      })}
    </div>
  );
};

// Column selector component
const ColumnSelector: React.FC<{
  columns: ColumnInfo[];
  selected: string[];
  onChange: (columns: string[]) => void;
}> = ({ columns, selected, onChange }) => {
  const narrativeColumns = columns.filter(c => c.isNarrative);
  const otherColumns = columns.filter(c => !c.isNarrative);
  
  const handleToggle = (columnName: string) => {
    if (selected.includes(columnName)) {
      onChange(selected.filter(c => c !== columnName));
    } else {
      onChange([...selected, columnName]);
    }
  };
  
  const handleSelectAll = (columnsToSelect: ColumnInfo[]) => {
    const names = columnsToSelect.map(c => c.name);
    const allSelected = names.every(n => selected.includes(n));
    
    if (allSelected) {
      onChange(selected.filter(c => !names.includes(c)));
    } else {
      onChange([...new Set([...selected, ...names])]);
    }
  };
  
  return (
    <div className="space-y-4">
      {narrativeColumns.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Detected Narrative Columns
            </Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSelectAll(narrativeColumns)}
            >
              {narrativeColumns.every(c => selected.includes(c.name))
                ? 'Deselect All'
                : 'Select All'}
            </Button>
          </div>
          <ScrollArea className="h-[150px] border rounded-md p-2">
            {narrativeColumns.map((col) => (
              <div
                key={col.name}
                className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded-md"
              >
                <Checkbox
                  id={`col-${col.name}`}
                  checked={selected.includes(col.name)}
                  onCheckedChange={() => handleToggle(col.name)}
                />
                <label
                  htmlFor={`col-${col.name}`}
                  className="flex-1 text-sm cursor-pointer"
                >
                  <span className="font-medium">{col.name}</span>
                  <span className="ml-2 text-muted-foreground">
                    ({col.rowCount} rows, avg {col.avgLength || '?'} chars)
                  </span>
                </label>
              </div>
            ))}
          </ScrollArea>
        </div>
      )}
      
      {otherColumns.length > 0 && (
        <Accordion type="single" collapsible>
          <AccordionItem value="other-columns">
            <AccordionTrigger className="text-sm">
              Other Columns ({otherColumns.length})
            </AccordionTrigger>
            <AccordionContent>
              <ScrollArea className="h-[100px] border rounded-md p-2">
                {otherColumns.map((col) => (
                  <div
                    key={col.name}
                    className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded-md"
                  >
                    <Checkbox
                      id={`col-other-${col.name}`}
                      checked={selected.includes(col.name)}
                      onCheckedChange={() => handleToggle(col.name)}
                    />
                    <label
                      htmlFor={`col-other-${col.name}`}
                      className="text-sm cursor-pointer"
                    >
                      {col.name}
                    </label>
                  </div>
                ))}
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
      
      {columns.length === 0 && (
        <div className="text-sm text-muted-foreground p-4 text-center border rounded-md">
          No columns detected. Upload a dataset to see available columns.
        </div>
      )}
    </div>
  );
};

// Cost estimate display
const CostEstimateDisplay: React.FC<{ estimate?: CostEstimate }> = ({ estimate }) => {
  if (!estimate) return null;
  
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-muted/30 rounded-lg">
      <div className="text-center">
        <div className="text-xs text-muted-foreground">Cells</div>
        <div className="text-lg font-semibold">{estimate.estimatedCells.toLocaleString()}</div>
      </div>
      <div className="text-center">
        <div className="text-xs text-muted-foreground">Est. Tokens</div>
        <div className="text-lg font-semibold">{estimate.estimatedTokens.toLocaleString()}</div>
      </div>
      <div className="text-center">
        <div className="text-xs text-muted-foreground">Est. Cost</div>
        <div className="text-lg font-semibold text-green-600">
          ${estimate.estimatedCostUsd.toFixed(2)}
        </div>
      </div>
      <div className="text-center">
        <div className="text-xs text-muted-foreground">Est. Time</div>
        <div className="text-lg font-semibold">{formatTime(estimate.estimatedTimeSeconds)}</div>
      </div>
    </div>
  );
};

export function ExtractionConfigPanel({
  columns,
  config,
  onConfigChange,
  onStartExtraction,
  costEstimate,
  isLoading = false,
  disabled = false,
  className,
}: ExtractionConfigPanelProps) {
  // Update config helper
  const updateConfig = <K extends keyof ExtractionConfig>(
    key: K,
    value: ExtractionConfig[K]
  ) => {
    onConfigChange({ ...config, [key]: value });
  };
  
  // Validation
  const canStart = useMemo(() => {
    return config.columns.length > 0 && !isLoading && !disabled;
  }, [config.columns, isLoading, disabled]);
  
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          <CardTitle className="text-lg">Extraction Configuration</CardTitle>
        </div>
        <CardDescription>
          Configure how clinical data will be extracted from your dataset
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Model Tier Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Model Tier</Label>
          <TierSelector
            value={config.tier}
            onChange={(tier) => updateConfig('tier', tier)}
          />
        </div>
        
        {/* Column Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Table className="h-4 w-4" />
            Columns to Extract
          </Label>
          <ColumnSelector
            columns={columns}
            selected={config.columns}
            onChange={(cols) => updateConfig('columns', cols)}
          />
        </div>
        
        {/* PHI Options */}
        <div className="space-y-4 p-4 border rounded-lg bg-amber-50/50 dark:bg-amber-950/10">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-500" />
            <Label className="text-sm font-medium">PHI Protection</Label>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enable-phi" className="text-sm">Enable PHI Scanning</Label>
              <p className="text-xs text-muted-foreground">
                Scan cells for protected health information before extraction
              </p>
            </div>
            <Switch
              id="enable-phi"
              checked={config.enablePhiScanning}
              onCheckedChange={(checked) => updateConfig('enablePhiScanning', checked)}
            />
          </div>
          
          {config.enablePhiScanning && (
            <div className="flex items-center justify-between pl-4 border-l-2 border-amber-300">
              <div className="space-y-0.5">
                <Label htmlFor="block-phi" className="text-sm">Block on PHI Detection</Label>
                <p className="text-xs text-muted-foreground">
                  Stop extraction if PHI is detected (recommended)
                </p>
              </div>
              <Switch
                id="block-phi"
                checked={config.blockOnPhi}
                onCheckedChange={(checked) => updateConfig('blockOnPhi', checked)}
              />
            </div>
          )}
        </div>
        
        {/* NLM Enrichment */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-blue-500" />
            <div className="space-y-0.5">
              <Label htmlFor="enable-nlm" className="text-sm font-medium">MeSH Enrichment</Label>
              <p className="text-xs text-muted-foreground">
                Enrich extracted terms with NLM MeSH identifiers
              </p>
            </div>
          </div>
          <Switch
            id="enable-nlm"
            checked={config.enableNlmEnrichment}
            onCheckedChange={(checked) => updateConfig('enableNlmEnrichment', checked)}
          />
        </div>
        
        {/* Advanced Options */}
        <Accordion type="single" collapsible>
          <AccordionItem value="advanced">
            <AccordionTrigger className="text-sm">Advanced Options</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              {/* Min Text Length */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Minimum Text Length</Label>
                  <span className="text-sm text-muted-foreground">
                    {config.minTextLength} characters
                  </span>
                </div>
                <Slider
                  value={[config.minTextLength]}
                  onValueChange={([value]) => updateConfig('minTextLength', value)}
                  min={10}
                  max={500}
                  step={10}
                />
                <p className="text-xs text-muted-foreground">
                  Skip cells with fewer characters than this threshold
                </p>
              </div>
              
              {/* Concurrency */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Max Concurrent</Label>
                  <span className="text-sm text-muted-foreground">
                    {config.maxConcurrent} requests
                  </span>
                </div>
                <Slider
                  value={[config.maxConcurrent]}
                  onValueChange={([value]) => updateConfig('maxConcurrent', value)}
                  min={1}
                  max={20}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  Number of parallel extraction requests
                </p>
              </div>
              
              {/* Output Format */}
              <div className="space-y-2">
                <Label className="text-sm">Output Format</Label>
                <Select
                  value={config.outputFormat}
                  onValueChange={(value: 'json' | 'parquet' | 'csv') =>
                    updateConfig('outputFormat', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">JSON (Full Detail)</SelectItem>
                    <SelectItem value="parquet">Parquet (Efficient Storage)</SelectItem>
                    <SelectItem value="csv">CSV (Spreadsheet Compatible)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        
        {/* Cost Estimate */}
        {costEstimate && (
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Cost Estimate
            </Label>
            <CostEstimateDisplay estimate={costEstimate} />
          </div>
        )}
        
        {/* Warnings */}
        {!config.enablePhiScanning && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
            <div className="text-sm text-amber-700 dark:text-amber-400">
              PHI scanning is disabled. Ensure your data is already de-identified before proceeding.
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter>
        <Button
          className="w-full"
          size="lg"
          onClick={onStartExtraction}
          disabled={!canStart}
        >
          {isLoading ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              Starting Extraction...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Start Extraction ({config.columns.length} columns)
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default ExtractionConfigPanel;
