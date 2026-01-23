/**
 * Stage 02 - Literature Review
 * Task - Implement Stage 02 UI
 * Search and summarize relevant scientific literature
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  BookOpen,
  Search,
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  RefreshCcw,
  Download,
  ExternalLink,
  FileText,
  Calendar,
  User,
  Quote,
  Star,
  StarOff,
  Copy,
  Filter,
  SortAsc,
  SortDesc,
  Database,
  ChevronDown,
  ChevronUp,
  FileJson,
  Globe,
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
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ModelTierSelect, type ModelTier } from '@/components/ai';

// Citation types
export interface Citation {
  id: string;
  title: string;
  authors: string[];
  year: number;
  journal?: string;
  doi?: string;
  pmid?: string;
  abstract?: string;
  source: 'pubmed' | 'google_scholar' | 'semantic_scholar' | 'crossref' | 'manual';
  url?: string;
  citationCount?: number;
  isStarred: boolean;
  isSelected: boolean;
  tags: string[];
  notes?: string;
  aiSummary?: string;
  relevanceScore?: number;
  addedAt: Date;
  updatedAt: Date;
}

export interface LiteratureSummary {
  id: string;
  title: string;
  content: string;
  citationIds: string[];
  aiGenerated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchQuery {
  query: string;
  source: 'pubmed' | 'google_scholar' | 'semantic_scholar' | 'all';
  dateRange?: { from: number; to: number };
  maxResults: number;
}

interface Stage02Props {
  citations: Citation[];
  onCitationsChange: (citations: Citation[]) => void;
  summaries: LiteratureSummary[];
  onSummariesChange: (summaries: LiteratureSummary[]) => void;
  researchContext?: string;
  onContextChange?: (context: string) => void;
  modelTier: ModelTier;
  onModelTierChange: (tier: ModelTier) => void;
  onSearch?: (query: SearchQuery) => Promise<Citation[]>;
  onSummarize?: (citations: Citation[], context: string) => Promise<string>;
  onSummarizeSingle?: (citation: Citation) => Promise<string>;
  onExportCitations?: (citations: Citation[]) => void;
  onExportSummary?: (summary: LiteratureSummary) => void;
  isSearching?: boolean;
  isSummarizing?: boolean;
  className?: string;
}

export function Stage02LiteratureReview({
  citations,
  onCitationsChange,
  summaries,
  onSummariesChange,
  researchContext = '',
  onContextChange,
  modelTier,
  onModelTierChange,
  onSearch,
  onSummarize,
  onSummarizeSingle,
  onExportCitations,
  onExportSummary,
  isSearching = false,
  isSummarizing = false,
  className,
}: Stage02Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSource, setSearchSource] = useState<SearchQuery['source']>('all');
  const [yearFrom, setYearFrom] = useState<string>('');
  const [yearTo, setYearTo] = useState<string>('');
  const [selectedTab, setSelectedTab] = useState('search');
  const [sortBy, setSortBy] = useState<'year' | 'citations' | 'relevance' | 'added'>('added');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterStarred, setFilterStarred] = useState(false);
  const [localContext, setLocalContext] = useState(researchContext);
  const [editingSummaryId, setEditingSummaryId] = useState<string | null>(null);
  const [editSummaryText, setEditSummaryText] = useState('');

  // Execute search
  const handleSearch = useCallback(async () => {
    if (!onSearch || !searchQuery.trim()) return;

    const query: SearchQuery = {
      query: searchQuery,
      source: searchSource,
      maxResults: 50,
    };

    if (yearFrom || yearTo) {
      query.dateRange = {
        from: yearFrom ? parseInt(yearFrom) : 1900,
        to: yearTo ? parseInt(yearTo) : new Date().getFullYear(),
      };
    }

    const results = await onSearch(query);
    // Add to citations (deduplicate by DOI or title)
    const existingIds = new Set(citations.map((c) => c.doi || c.title));
    const newCitations = results.filter((r) => !existingIds.has(r.doi || r.title));
    onCitationsChange([...citations, ...newCitations]);
  }, [onSearch, searchQuery, searchSource, yearFrom, yearTo, citations, onCitationsChange]);

  // Generate literature summary
  const handleGenerateSummary = useCallback(async () => {
    if (!onSummarize) return;
    const selectedCitations = citations.filter((c) => c.isSelected);
    if (selectedCitations.length === 0) return;

    const summaryContent = await onSummarize(selectedCitations, localContext);

    const newSummary: LiteratureSummary = {
      id: crypto.randomUUID(),
      title: `Literature Summary - ${new Date().toLocaleDateString()}`,
      content: summaryContent,
      citationIds: selectedCitations.map((c) => c.id),
      aiGenerated: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    onSummariesChange([...summaries, newSummary]);
    setSelectedTab('summaries');
  }, [onSummarize, citations, localContext, summaries, onSummariesChange]);

  // Summarize single citation
  const handleSummarizeSingle = useCallback(
    async (citation: Citation) => {
      if (!onSummarizeSingle) return;
      const summary = await onSummarizeSingle(citation);
      onCitationsChange(
        citations.map((c) =>
          c.id === citation.id ? { ...c, aiSummary: summary, updatedAt: new Date() } : c
        )
      );
    },
    [onSummarizeSingle, citations, onCitationsChange]
  );

  // Toggle star
  const toggleStar = useCallback(
    (id: string) => {
      onCitationsChange(
        citations.map((c) =>
          c.id === id ? { ...c, isStarred: !c.isStarred, updatedAt: new Date() } : c
        )
      );
    },
    [citations, onCitationsChange]
  );

  // Toggle selection
  const toggleSelect = useCallback(
    (id: string) => {
      onCitationsChange(
        citations.map((c) =>
          c.id === id ? { ...c, isSelected: !c.isSelected, updatedAt: new Date() } : c
        )
      );
    },
    [citations, onCitationsChange]
  );

  // Delete citation
  const deleteCitation = useCallback(
    (id: string) => {
      onCitationsChange(citations.filter((c) => c.id !== id));
    },
    [citations, onCitationsChange]
  );

  // Add manual citation
  const addManualCitation = useCallback(() => {
    const newCitation: Citation = {
      id: crypto.randomUUID(),
      title: '',
      authors: [],
      year: new Date().getFullYear(),
      source: 'manual',
      isStarred: false,
      isSelected: false,
      tags: [],
      addedAt: new Date(),
      updatedAt: new Date(),
    };
    onCitationsChange([...citations, newCitation]);
  }, [citations, onCitationsChange]);

  // Select all / none
  const selectAll = useCallback(
    (selected: boolean) => {
      onCitationsChange(citations.map((c) => ({ ...c, isSelected: selected })));
    },
    [citations, onCitationsChange]
  );

  // Export citations to JSON
  const handleExportCitations = useCallback(() => {
    const selectedCitations = citations.filter((c) => c.isSelected);
    if (onExportCitations) {
      onExportCitations(selectedCitations.length > 0 ? selectedCitations : citations);
    } else {
      // Default export behavior
      const exportData = (selectedCitations.length > 0 ? selectedCitations : citations).map((c) => ({
        title: c.title,
        authors: c.authors,
        year: c.year,
        journal: c.journal,
        doi: c.doi,
        pmid: c.pmid,
        abstract: c.abstract,
        source: c.source,
        url: c.url,
        citationCount: c.citationCount,
        tags: c.tags,
        notes: c.notes,
        aiSummary: c.aiSummary,
      }));
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'citations.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [citations, onExportCitations]);

  // Delete summary
  const deleteSummary = useCallback(
    (id: string) => {
      onSummariesChange(summaries.filter((s) => s.id !== id));
    },
    [summaries, onSummariesChange]
  );

  // Update summary
  const updateSummary = useCallback(
    (id: string, updates: Partial<LiteratureSummary>) => {
      onSummariesChange(
        summaries.map((s) =>
          s.id === id ? { ...s, ...updates, updatedAt: new Date() } : s
        )
      );
    },
    [summaries, onSummariesChange]
  );

  // Save summary edit
  const saveSummaryEdit = useCallback(() => {
    if (editingSummaryId && editSummaryText.trim()) {
      updateSummary(editingSummaryId, { content: editSummaryText.trim() });
    }
    setEditingSummaryId(null);
    setEditSummaryText('');
  }, [editingSummaryId, editSummaryText, updateSummary]);

  // Copy to clipboard
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  // Filter and sort citations
  const displayedCitations = useMemo(() => {
    let filtered = [...citations];

    if (filterStarred) {
      filtered = filtered.filter((c) => c.isStarred);
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'year':
          comparison = a.year - b.year;
          break;
        case 'citations':
          comparison = (a.citationCount || 0) - (b.citationCount || 0);
          break;
        case 'relevance':
          comparison = (a.relevanceScore || 0) - (b.relevanceScore || 0);
          break;
        case 'added':
          comparison = a.addedAt.getTime() - b.addedAt.getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [citations, filterStarred, sortBy, sortOrder]);

  const selectedCount = citations.filter((c) => c.isSelected).length;
  const starredCount = citations.filter((c) => c.isStarred).length;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Research Context */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Research Context
          </CardTitle>
          <CardDescription>
            Describe your research focus to help AI understand what literature is most relevant
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Enter your research context, key questions, and areas of interest for the literature review..."
            value={localContext}
            onChange={(e) => {
              setLocalContext(e.target.value);
              onContextChange?.(e.target.value);
            }}
            rows={3}
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-48">
                <Label className="text-xs mb-1">AI Model</Label>
                <ModelTierSelect
                  value={modelTier}
                  onChange={onModelTierChange}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="search">
            <Search className="mr-2 h-4 w-4" />
            Search
          </TabsTrigger>
          <TabsTrigger value="library">
            <Database className="mr-2 h-4 w-4" />
            Library ({citations.length})
          </TabsTrigger>
          <TabsTrigger value="selected">
            <FileText className="mr-2 h-4 w-4" />
            Selected ({selectedCount})
          </TabsTrigger>
          <TabsTrigger value="summaries">
            <Sparkles className="mr-2 h-4 w-4" />
            Summaries ({summaries.length})
          </TabsTrigger>
        </TabsList>

        {/* Search Tab */}
        <TabsContent value="search" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Literature Search</CardTitle>
              <CardDescription>
                Search PubMed, Google Scholar, Semantic Scholar, and other databases
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Enter search terms, keywords, or research questions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <Select value={searchSource} onValueChange={(v) => setSearchSource(v as SearchQuery['source'])}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="pubmed">PubMed</SelectItem>
                    <SelectItem value="google_scholar">Google Scholar</SelectItem>
                    <SelectItem value="semantic_scholar">Semantic Scholar</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
                  {isSearching ? (
                    <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Search
                </Button>
              </div>

              {/* Date filters */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Year:</Label>
                  <Input
                    type="number"
                    placeholder="From"
                    value={yearFrom}
                    onChange={(e) => setYearFrom(e.target.value)}
                    className="w-24"
                    min={1900}
                    max={new Date().getFullYear()}
                  />
                  <span>-</span>
                  <Input
                    type="number"
                    placeholder="To"
                    value={yearTo}
                    onChange={(e) => setYearTo(e.target.value)}
                    className="w-24"
                    min={1900}
                    max={new Date().getFullYear()}
                  />
                </div>
              </div>

              {/* Database cards */}
              <div className="grid grid-cols-4 gap-4">
                <Card
                  className="p-4 cursor-pointer hover:bg-muted/50"
                  onClick={() => setSearchSource('pubmed')}
                >
                  <div className="flex items-center gap-3">
                    <Database className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="font-medium">PubMed</p>
                      <p className="text-xs text-muted-foreground">Biomedical literature</p>
                    </div>
                  </div>
                </Card>
                <Card
                  className="p-4 cursor-pointer hover:bg-muted/50"
                  onClick={() => setSearchSource('google_scholar')}
                >
                  <div className="flex items-center gap-3">
                    <Globe className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="font-medium">Google Scholar</p>
                      <p className="text-xs text-muted-foreground">Multidisciplinary</p>
                    </div>
                  </div>
                </Card>
                <Card
                  className="p-4 cursor-pointer hover:bg-muted/50"
                  onClick={() => setSearchSource('semantic_scholar')}
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-8 w-8 text-purple-600" />
                    <div>
                      <p className="font-medium">Semantic Scholar</p>
                      <p className="text-xs text-muted-foreground">AI-powered search</p>
                    </div>
                  </div>
                </Card>
                <Card
                  className="p-4 cursor-pointer hover:bg-muted/50"
                  onClick={addManualCitation}
                >
                  <div className="flex items-center gap-3">
                    <Plus className="h-8 w-8 text-gray-600" />
                    <div>
                      <p className="font-medium">Add Manually</p>
                      <p className="text-xs text-muted-foreground">Import DOI or entry</p>
                    </div>
                  </div>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Library Tab */}
        <TabsContent value="library" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Citation Library</CardTitle>
                  <CardDescription>
                    {citations.length} citations - {starredCount} starred - {selectedCount} selected
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilterStarred(!filterStarred)}
                  >
                    {filterStarred ? (
                      <Star className="mr-2 h-4 w-4 fill-yellow-400" />
                    ) : (
                      <StarOff className="mr-2 h-4 w-4" />
                    )}
                    {filterStarred ? 'Show All' : 'Starred Only'}
                  </Button>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="added">Date Added</SelectItem>
                      <SelectItem value="year">Year</SelectItem>
                      <SelectItem value="citations">Citations</SelectItem>
                      <SelectItem value="relevance">Relevance</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  >
                    {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                <Checkbox
                  checked={selectedCount === citations.length && citations.length > 0}
                  onCheckedChange={(checked) => selectAll(!!checked)}
                />
                <span className="text-sm text-muted-foreground">Select all</span>
                {selectedCount > 0 && (
                  <>
                    <Separator orientation="vertical" className="h-4 mx-2" />
                    <Button variant="outline" size="sm" onClick={handleExportCitations}>
                      <FileJson className="mr-2 h-4 w-4" />
                      Export JSON
                    </Button>
                  </>
                )}
              </div>

              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {displayedCitations.map((citation) => (
                    <CitationCard
                      key={citation.id}
                      citation={citation}
                      onToggleStar={() => toggleStar(citation.id)}
                      onToggleSelect={() => toggleSelect(citation.id)}
                      onDelete={() => deleteCitation(citation.id)}
                      onSummarize={() => handleSummarizeSingle(citation)}
                      onCopy={() => copyToClipboard(citation.title)}
                      isSummarizing={isSummarizing}
                    />
                  ))}
                  {displayedCitations.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No citations found</p>
                      <p className="text-sm">Search for literature to add citations</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Selected Tab */}
        <TabsContent value="selected" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Selected Citations</CardTitle>
                  <CardDescription>
                    Citations selected for your literature review ({selectedCount} items)
                  </CardDescription>
                </div>
                {selectedCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleExportCitations}>
                      <FileJson className="mr-2 h-4 w-4" />
                      Export JSON
                    </Button>
                    <Button onClick={handleGenerateSummary} disabled={isSummarizing}>
                      {isSummarizing ? (
                        <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Generate Summary
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {selectedCount > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {citations
                      .filter((c) => c.isSelected)
                      .map((citation) => (
                        <CitationCard
                          key={citation.id}
                          citation={citation}
                          onToggleStar={() => toggleStar(citation.id)}
                          onToggleSelect={() => toggleSelect(citation.id)}
                          onDelete={() => deleteCitation(citation.id)}
                          onSummarize={() => handleSummarizeSingle(citation)}
                          onCopy={() => copyToClipboard(citation.title)}
                          isSummarizing={isSummarizing}
                        />
                      ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No citations selected</p>
                  <p className="text-sm">Select citations from your library to include in your literature review</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Summaries Tab */}
        <TabsContent value="summaries" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Literature Summaries</CardTitle>
              <CardDescription>
                AI-generated summaries of your selected literature
              </CardDescription>
            </CardHeader>
            <CardContent>
              {summaries.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {summaries.map((summary) => (
                      <SummaryCard
                        key={summary.id}
                        summary={summary}
                        citationCount={
                          citations.filter((c) => summary.citationIds.includes(c.id)).length
                        }
                        isEditing={editingSummaryId === summary.id}
                        editText={editSummaryText}
                        onEditTextChange={setEditSummaryText}
                        onStartEdit={() => {
                          setEditingSummaryId(summary.id);
                          setEditSummaryText(summary.content);
                        }}
                        onSaveEdit={saveSummaryEdit}
                        onCancelEdit={() => {
                          setEditingSummaryId(null);
                          setEditSummaryText('');
                        }}
                        onDelete={() => deleteSummary(summary.id)}
                        onCopy={() => copyToClipboard(summary.content)}
                        onExport={() => onExportSummary?.(summary)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No summaries yet</p>
                  <p className="text-sm">Select citations and generate an AI-powered summary</p>
                  {selectedCount > 0 && (
                    <Button className="mt-4" onClick={handleGenerateSummary} disabled={isSummarizing}>
                      {isSummarizing ? (
                        <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Generate Summary from {selectedCount} citations
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Citation Card Component
interface CitationCardProps {
  citation: Citation;
  onToggleStar: () => void;
  onToggleSelect: () => void;
  onDelete: () => void;
  onSummarize: () => void;
  onCopy: () => void;
  isSummarizing?: boolean;
}

function CitationCard({
  citation,
  onToggleStar,
  onToggleSelect,
  onDelete,
  onSummarize,
  onCopy,
  isSummarizing,
}: CitationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const sourceColors: Record<Citation['source'], string> = {
    pubmed: 'bg-blue-100 text-blue-700',
    google_scholar: 'bg-green-100 text-green-700',
    semantic_scholar: 'bg-purple-100 text-purple-700',
    crossref: 'bg-orange-100 text-orange-700',
    manual: 'bg-gray-100 text-gray-700',
  };

  const sourceLabels: Record<Citation['source'], string> = {
    pubmed: 'PubMed',
    google_scholar: 'Google Scholar',
    semantic_scholar: 'Semantic Scholar',
    crossref: 'CrossRef',
    manual: 'Manual',
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className={cn(citation.isSelected && 'ring-2 ring-primary')}>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Checkbox
              checked={citation.isSelected}
              onCheckedChange={onToggleSelect}
            />

            <div className="flex-1 min-w-0">
              <CollapsibleTrigger asChild>
                <button className="text-left w-full">
                  <h4 className="font-medium text-sm hover:text-primary transition-colors">
                    {citation.title || 'Untitled citation'}
                  </h4>
                </button>
              </CollapsibleTrigger>

              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span className="truncate">
                  {citation.authors.length > 0
                    ? citation.authors.slice(0, 3).join(', ') +
                      (citation.authors.length > 3 ? ' et al.' : '')
                    : 'Unknown authors'}
                </span>
                <span>-</span>
                <Calendar className="h-3 w-3" />
                <span>{citation.year}</span>
                {citation.journal && (
                  <>
                    <span>-</span>
                    <span className="truncate">{citation.journal}</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 mt-2">
                <Badge className={cn('text-xs', sourceColors[citation.source])}>
                  {sourceLabels[citation.source]}
                </Badge>
                {citation.citationCount !== undefined && (
                  <Badge variant="outline" className="text-xs">
                    <Quote className="mr-1 h-3 w-3" />
                    {citation.citationCount} citations
                  </Badge>
                )}
                {citation.relevanceScore !== undefined && (
                  <Badge variant="outline" className="text-xs">
                    Relevance: {Math.round(citation.relevanceScore * 100)}%
                  </Badge>
                )}
                {citation.aiSummary && (
                  <Badge variant="secondary" className="text-xs">
                    <Sparkles className="mr-1 h-3 w-3" />
                    Summarized
                  </Badge>
                )}
                {citation.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onToggleStar}
              >
                <Star
                  className={cn(
                    'h-4 w-4',
                    citation.isStarred && 'fill-yellow-400 text-yellow-400'
                  )}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onSummarize}
                disabled={isSummarizing}
              >
                <Sparkles className="h-4 w-4" />
              </Button>
              {(citation.doi || citation.url) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  asChild
                >
                  <a
                    href={citation.doi ? `https://doi.org/${citation.doi}` : citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onCopy}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <CollapsibleContent>
            {citation.abstract && (
              <div className="mt-4 pt-4 border-t">
                <h5 className="text-xs font-medium text-muted-foreground mb-2">Abstract</h5>
                <p className="text-sm text-muted-foreground">{citation.abstract}</p>
              </div>
            )}
            {citation.aiSummary && (
              <div className="mt-4 pt-4 border-t">
                <h5 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI Summary
                </h5>
                <p className="text-sm text-muted-foreground">{citation.aiSummary}</p>
              </div>
            )}
            <div className="mt-4 flex gap-4 text-xs">
              {citation.doi && (
                <div>
                  <span className="font-medium">DOI:</span>{' '}
                  <a
                    href={`https://doi.org/${citation.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {citation.doi}
                  </a>
                </div>
              )}
              {citation.pmid && (
                <div>
                  <span className="font-medium">PMID:</span>{' '}
                  <a
                    href={`https://pubmed.ncbi.nlm.nih.gov/${citation.pmid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {citation.pmid}
                  </a>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}

// Summary Card Component
interface SummaryCardProps {
  summary: LiteratureSummary;
  citationCount: number;
  isEditing: boolean;
  editText: string;
  onEditTextChange: (text: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onExport?: () => void;
}

function SummaryCard({
  summary,
  citationCount,
  isEditing,
  editText,
  onEditTextChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onCopy,
  onExport,
}: SummaryCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{summary.title}</CardTitle>
            <CardDescription className="text-xs">
              Based on {citationCount} citations - Created{' '}
              {summary.createdAt.toLocaleDateString()}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {summary.aiGenerated && (
              <Badge variant="outline" className="text-xs">
                <Sparkles className="mr-1 h-3 w-3" />
                AI Generated
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editText}
              onChange={(e) => onEditTextChange(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={onCancelEdit}>
                <X className="mr-1 h-4 w-4" />
                Cancel
              </Button>
              <Button size="sm" onClick={onSaveEdit}>
                <Check className="mr-1 h-4 w-4" />
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none">
            <p className="text-sm whitespace-pre-wrap">{summary.content}</p>
          </div>
        )}
      </CardContent>
      {!isEditing && (
        <CardFooter className="pt-0">
          <div className="flex items-center gap-1 ml-auto">
            <Button variant="ghost" size="sm" onClick={onCopy}>
              <Copy className="mr-1 h-4 w-4" />
              Copy
            </Button>
            <Button variant="ghost" size="sm" onClick={onStartEdit}>
              <Edit3 className="mr-1 h-4 w-4" />
              Edit
            </Button>
            {onExport && (
              <Button variant="ghost" size="sm" onClick={onExport}>
                <Download className="mr-1 h-4 w-4" />
                Export
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Delete
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}

export default Stage02LiteratureReview;
