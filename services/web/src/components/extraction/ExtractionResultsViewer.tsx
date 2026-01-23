/**
 * ExtractionResultsViewer Component
 * 
 * Displays extracted clinical data with:
 * - Category tabs (diagnoses, procedures, medications, etc.)
 * - Evidence highlighting
 * - Confidence scores
 * - MeSH term enrichment
 * - Export functionality
 */

import * as React from 'react';
import { useState, useMemo } from 'react';
import {
  Stethoscope,
  Pill,
  Activity,
  AlertCircle,
  FileText,
  CheckCircle2,
  ExternalLink,
  Copy,
  Download,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Types
export interface Evidence {
  quote: string;
  start?: number;
  end?: number;
}

export interface ExtractedItem {
  text: string;
  meshId?: string;
  meshTerm?: string;
  evidence: Evidence[];
  confidence?: number;
  category?: string;
  severity?: string;
  clavienDindo?: string;
}

export interface MedicationItem extends ExtractedItem {
  name: string;
  dose?: string;
  route?: string;
  frequency?: string;
  duration?: string;
  indication?: string;
  timing?: string;
}

export interface StudyFields {
  asaClass?: string;
  bmi?: number;
  estimatedBloodLossMl?: number;
  operativeTimeMinutes?: number;
  lengthOfStayDays?: number;
  conversionToOpen?: boolean;
  readmission30day?: boolean;
  mortality30day?: boolean;
  woundClass?: string;
  drainPlaced?: boolean;
  specimenSent?: boolean;
}

export interface ClinicalExtraction {
  noteType?: string;
  extractionVersion?: string;
  diagnoses: ExtractedItem[];
  procedures: ExtractedItem[];
  medications: MedicationItem[];
  outcomes: ExtractedItem[];
  complications: ExtractedItem[];
  rosSymptoms?: ExtractedItem[];
  vitalSigns?: Array<{ name: string; value: string; unit?: string }>;
  labResults?: Array<{ name: string; value: string; unit?: string; abnormal?: boolean }>;
  studyFields: StudyFields;
  confidence: number;
  warnings: string[];
}

export interface ExtractionResultsViewerProps {
  extraction: ClinicalExtraction;
  originalText?: string;
  onExport?: (format: 'json' | 'csv') => void;
  onCopyItem?: (item: ExtractedItem) => void;
  className?: string;
}

// Confidence badge component
const ConfidenceBadge: React.FC<{ confidence?: number }> = ({ confidence }) => {
  if (confidence === undefined) return null;
  
  const getColor = (c: number) => {
    if (c >= 0.9) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (c >= 0.7) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    if (c >= 0.5) return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  };
  
  return (
    <Badge variant="outline" className={cn('text-xs', getColor(confidence))}>
      {Math.round(confidence * 100)}%
    </Badge>
  );
};

// MeSH link component
const MeSHLink: React.FC<{ meshId?: string; meshTerm?: string }> = ({ meshId, meshTerm }) => {
  if (!meshId) return null;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={`https://meshb.nlm.nih.gov/record/ui?ui=${meshId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            <span>{meshId}</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </TooltipTrigger>
        <TooltipContent>
          {meshTerm || 'View in MeSH Browser'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Evidence display component
const EvidenceDisplay: React.FC<{ evidence: Evidence[]; originalText?: string }> = ({
  evidence,
  originalText,
}) => {
  if (!evidence || evidence.length === 0) return null;
  
  return (
    <div className="mt-2 space-y-1">
      {evidence.map((ev, idx) => (
        <div
          key={idx}
          className="pl-3 border-l-2 border-muted text-sm text-muted-foreground italic"
        >
          "{ev.quote}"
        </div>
      ))}
    </div>
  );
};

// Single item card
const ItemCard: React.FC<{
  item: ExtractedItem;
  originalText?: string;
  onCopy?: () => void;
}> = ({ item, originalText, onCopy }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="p-3 border rounded-md hover:bg-muted/30 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <CollapsibleTrigger className="flex items-center gap-2 text-left flex-1">
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="font-medium">{item.text}</span>
          </CollapsibleTrigger>
          <div className="flex items-center gap-2">
            <ConfidenceBadge confidence={item.confidence} />
            <MeSHLink meshId={item.meshId} meshTerm={item.meshTerm} />
            {onCopy && (
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onCopy}>
                <Copy className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Additional metadata */}
        <div className="flex flex-wrap gap-1 mt-1 ml-6">
          {item.category && (
            <Badge variant="secondary" className="text-xs">
              {item.category}
            </Badge>
          )}
          {item.severity && (
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                item.severity === 'major' && 'border-red-500 text-red-600',
                item.severity === 'minor' && 'border-amber-500 text-amber-600'
              )}
            >
              {item.severity}
            </Badge>
          )}
          {item.clavienDindo && (
            <Badge variant="outline" className="text-xs">
              CD-{item.clavienDindo}
            </Badge>
          )}
        </div>
        
        <CollapsibleContent>
          <EvidenceDisplay evidence={item.evidence} originalText={originalText} />
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

// Medication card with additional fields
const MedicationCard: React.FC<{
  med: MedicationItem;
  onCopy?: () => void;
}> = ({ med, onCopy }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="p-3 border rounded-md hover:bg-muted/30 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <CollapsibleTrigger className="flex items-center gap-2 text-left flex-1">
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <span className="font-medium">{med.name}</span>
              {med.dose && (
                <span className="ml-2 text-muted-foreground">{med.dose}</span>
              )}
            </div>
          </CollapsibleTrigger>
          <div className="flex items-center gap-2">
            {med.timing && (
              <Badge variant="outline" className="text-xs">
                {med.timing}
              </Badge>
            )}
            {onCopy && (
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onCopy}>
                <Copy className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        
        <CollapsibleContent>
          <div className="mt-2 ml-6 space-y-1 text-sm">
            {med.route && (
              <div className="flex gap-2">
                <span className="text-muted-foreground">Route:</span>
                <span>{med.route}</span>
              </div>
            )}
            {med.frequency && (
              <div className="flex gap-2">
                <span className="text-muted-foreground">Frequency:</span>
                <span>{med.frequency}</span>
              </div>
            )}
            {med.duration && (
              <div className="flex gap-2">
                <span className="text-muted-foreground">Duration:</span>
                <span>{med.duration}</span>
              </div>
            )}
            {med.indication && (
              <div className="flex gap-2">
                <span className="text-muted-foreground">Indication:</span>
                <span>{med.indication}</span>
              </div>
            )}
            {med.evidence && med.evidence.length > 0 && (
              <EvidenceDisplay evidence={med.evidence} />
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

// Study fields display
const StudyFieldsDisplay: React.FC<{ fields: StudyFields }> = ({ fields }) => {
  const fieldDefinitions = [
    { key: 'asaClass', label: 'ASA Class', format: (v: string) => v },
    { key: 'bmi', label: 'BMI', format: (v: number) => v?.toFixed(1) },
    { key: 'estimatedBloodLossMl', label: 'EBL', format: (v: number) => `${v} mL` },
    { key: 'operativeTimeMinutes', label: 'OR Time', format: (v: number) => `${v} min` },
    { key: 'lengthOfStayDays', label: 'LOS', format: (v: number) => `${v} days` },
    { key: 'conversionToOpen', label: 'Conversion', format: (v: boolean) => v ? 'Yes' : 'No' },
    { key: 'woundClass', label: 'Wound Class', format: (v: string) => v },
    { key: 'readmission30day', label: '30-day Readmission', format: (v: boolean) => v ? 'Yes' : 'No' },
    { key: 'mortality30day', label: '30-day Mortality', format: (v: boolean) => v ? 'Yes' : 'No' },
  ];
  
  const presentFields = fieldDefinitions.filter(
    f => fields[f.key as keyof StudyFields] !== undefined && fields[f.key as keyof StudyFields] !== null
  );
  
  if (presentFields.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4 text-center">
        No study fields extracted
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3">
      {presentFields.map(({ key, label, format }) => {
        const value = fields[key as keyof StudyFields];
        return (
          <div key={key} className="p-2 border rounded-md bg-muted/30">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="font-medium">{format(value as never)}</div>
          </div>
        );
      })}
    </div>
  );
};

// Category configuration
const CATEGORIES = [
  { id: 'diagnoses', label: 'Diagnoses', icon: Stethoscope },
  { id: 'procedures', label: 'Procedures', icon: Activity },
  { id: 'medications', label: 'Medications', icon: Pill },
  { id: 'outcomes', label: 'Outcomes', icon: CheckCircle2 },
  { id: 'complications', label: 'Complications', icon: AlertCircle },
  { id: 'studyFields', label: 'Study Fields', icon: FileText },
];

export function ExtractionResultsViewer({
  extraction,
  originalText,
  onExport,
  onCopyItem,
  className,
}: ExtractionResultsViewerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState<string>('all');
  
  // Filter items based on search and confidence
  const filterItems = <T extends ExtractedItem>(items: T[]): T[] => {
    return items.filter(item => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const textMatch = item.text?.toLowerCase().includes(searchLower);
        const evidenceMatch = item.evidence?.some(e => 
          e.quote?.toLowerCase().includes(searchLower)
        );
        if (!textMatch && !evidenceMatch) return false;
      }
      
      // Confidence filter
      if (confidenceFilter !== 'all' && item.confidence !== undefined) {
        const threshold = parseFloat(confidenceFilter);
        if (item.confidence < threshold) return false;
      }
      
      return true;
    });
  };
  
  // Get counts for each category
  const counts = useMemo(() => ({
    diagnoses: extraction.diagnoses?.length || 0,
    procedures: extraction.procedures?.length || 0,
    medications: extraction.medications?.length || 0,
    outcomes: extraction.outcomes?.length || 0,
    complications: extraction.complications?.length || 0,
    studyFields: Object.values(extraction.studyFields || {}).filter(v => v !== undefined && v !== null).length,
  }), [extraction]);
  
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Extraction Results</CardTitle>
            <CardDescription>
              {extraction.noteType && (
                <Badge variant="outline" className="mr-2">
                  {extraction.noteType.replace(/_/g, ' ')}
                </Badge>
              )}
              <ConfidenceBadge confidence={extraction.confidence} />
              {extraction.extractionVersion && (
                <span className="ml-2 text-xs">v{extraction.extractionVersion}</span>
              )}
            </CardDescription>
          </div>
          {onExport && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onExport('json')}>
                <Download className="h-4 w-4 mr-1" />
                JSON
              </Button>
              <Button variant="outline" size="sm" onClick={() => onExport('csv')}>
                <Download className="h-4 w-4 mr-1" />
                CSV
              </Button>
            </div>
          )}
        </div>
        
        {/* Filters */}
        <div className="flex gap-2 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search extractions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Confidence" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="0.9">≥90%</SelectItem>
              <SelectItem value="0.7">≥70%</SelectItem>
              <SelectItem value="0.5">≥50%</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Warnings */}
        {extraction.warnings && extraction.warnings.length > 0 && (
          <div className="mb-4 p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium text-sm">
              <AlertCircle className="h-4 w-4" />
              Extraction Warnings
            </div>
            <ul className="mt-2 text-sm text-amber-600 dark:text-amber-500 list-disc list-inside">
              {extraction.warnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Category Tabs */}
        <Tabs defaultValue="diagnoses" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            {CATEGORIES.map(({ id, label, icon: Icon }) => (
              <TabsTrigger key={id} value={id} className="text-xs">
                <Icon className="h-4 w-4 mr-1" />
                <span className="hidden md:inline">{label}</span>
                <Badge variant="secondary" className="ml-1 h-5 px-1">
                  {counts[id as keyof typeof counts]}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
          
          <ScrollArea className="h-[400px] mt-4">
            <TabsContent value="diagnoses" className="space-y-2">
              {filterItems(extraction.diagnoses || []).map((item, idx) => (
                <ItemCard
                  key={idx}
                  item={item}
                  originalText={originalText}
                  onCopy={onCopyItem ? () => onCopyItem(item) : undefined}
                />
              ))}
              {filterItems(extraction.diagnoses || []).length === 0 && (
                <div className="text-sm text-muted-foreground p-4 text-center">
                  No diagnoses extracted
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="procedures" className="space-y-2">
              {filterItems(extraction.procedures || []).map((item, idx) => (
                <ItemCard
                  key={idx}
                  item={item}
                  originalText={originalText}
                  onCopy={onCopyItem ? () => onCopyItem(item) : undefined}
                />
              ))}
              {filterItems(extraction.procedures || []).length === 0 && (
                <div className="text-sm text-muted-foreground p-4 text-center">
                  No procedures extracted
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="medications" className="space-y-2">
              {filterItems(extraction.medications || []).map((med, idx) => (
                <MedicationCard
                  key={idx}
                  med={med}
                  onCopy={onCopyItem ? () => onCopyItem(med) : undefined}
                />
              ))}
              {filterItems(extraction.medications || []).length === 0 && (
                <div className="text-sm text-muted-foreground p-4 text-center">
                  No medications extracted
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="outcomes" className="space-y-2">
              {filterItems(extraction.outcomes || []).map((item, idx) => (
                <ItemCard
                  key={idx}
                  item={item}
                  originalText={originalText}
                  onCopy={onCopyItem ? () => onCopyItem(item) : undefined}
                />
              ))}
              {filterItems(extraction.outcomes || []).length === 0 && (
                <div className="text-sm text-muted-foreground p-4 text-center">
                  No outcomes extracted
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="complications" className="space-y-2">
              {filterItems(extraction.complications || []).map((item, idx) => (
                <ItemCard
                  key={idx}
                  item={item}
                  originalText={originalText}
                  onCopy={onCopyItem ? () => onCopyItem(item) : undefined}
                />
              ))}
              {filterItems(extraction.complications || []).length === 0 && (
                <div className="text-sm text-muted-foreground p-4 text-center">
                  No complications extracted
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="studyFields">
              <StudyFieldsDisplay fields={extraction.studyFields} />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default ExtractionResultsViewer;
