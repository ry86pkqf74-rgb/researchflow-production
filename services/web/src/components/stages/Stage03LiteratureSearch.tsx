/**
 * Stage 03 - Literature Search
 * Task 43 - Implement Stage 03 UI
 * Literature discovery with PubMed, Semantic Scholar integration
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import {
  Search,
  BookOpen,
  ExternalLink,
  Download,
  Plus,
  Trash2,
  Filter,
  SortAsc,
  SortDesc,
  Calendar,
  User,
  Quote,
  Star,
  StarOff,
  RefreshCcw,
  FileText,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { cn } from '@/lib/utils';

// Reference types
export interface Reference {
  id: string;
  title: string;
  authors: string[];
  year: number;
  journal?: string;
  doi?: string;
  pmid?: string;
  abstract?: string;
  source: 'pubmed' | 'semantic_scholar' | 'manual' | 'crossref';
  citationCount?: number;
  isStarred: boolean;
  isSelected: boolean;
  tags: string[];
  notes?: string;
  addedAt: Date;
}

export interface SearchQuery {
  query: string;
  source: 'pubmed' | 'semantic_scholar' | 'all';
  dateRange?: { from: number; to: number };
  maxResults: number;
}

interface Stage03Props {
  references: Reference[];
  onReferencesChange: (references: Reference[]) => void;
  onSearch?: (query: SearchQuery) => Promise<Reference[]>;
  onExportBibtex?: (references: Reference[]) => void;
  isSearching?: boolean;
  className?: string;
}

export function Stage03LiteratureSearch({
  references,
  onReferencesChange,
  onSearch,
  onExportBibtex,
  isSearching = false,
  className,
}: Stage03Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSource, setSearchSource] = useState<'pubmed' | 'semantic_scholar' | 'all'>('all');
  const [sortBy, setSortBy] = useState<'year' | 'citations' | 'added'>('added');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterStarred, setFilterStarred] = useState(false);
  const [selectedTab, setSelectedTab] = useState('search');

  // Execute search
  const handleSearch = useCallback(async () => {
    if (!onSearch || !searchQuery.trim()) return;
    const results = await onSearch({
      query: searchQuery,
      source: searchSource,
      maxResults: 50,
    });
    // Add to references (deduplicate by DOI or title)
    const existingIds = new Set(references.map((r) => r.doi || r.title));
    const newRefs = results.filter((r) => !existingIds.has(r.doi || r.title));
    onReferencesChange([...references, ...newRefs]);
  }, [onSearch, searchQuery, searchSource, references, onReferencesChange]);

  // Toggle star
  const toggleStar = useCallback(
    (id: string) => {
      onReferencesChange(
        references.map((r) => (r.id === id ? { ...r, isStarred: !r.isStarred } : r))
      );
    },
    [references, onReferencesChange]
  );

  // Toggle selection
  const toggleSelect = useCallback(
    (id: string) => {
      onReferencesChange(
        references.map((r) => (r.id === id ? { ...r, isSelected: !r.isSelected } : r))
      );
    },
    [references, onReferencesChange]
  );

  // Delete reference
  const deleteReference = useCallback(
    (id: string) => {
      onReferencesChange(references.filter((r) => r.id !== id));
    },
    [references, onReferencesChange]
  );

  // Select all / none
  const selectAll = useCallback(
    (selected: boolean) => {
      onReferencesChange(references.map((r) => ({ ...r, isSelected: selected })));
    },
    [references, onReferencesChange]
  );

  // Filter and sort references
  const displayedReferences = React.useMemo(() => {
    let filtered = [...references];

    if (filterStarred) {
      filtered = filtered.filter((r) => r.isStarred);
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
        case 'added':
          comparison = a.addedAt.getTime() - b.addedAt.getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [references, filterStarred, sortBy, sortOrder]);

  const selectedCount = references.filter((r) => r.isSelected).length;
  const starredCount = references.filter((r) => r.isStarred).length;

  return (
    <div className={cn('space-y-6', className)}>
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="search">
            <Search className="mr-2 h-4 w-4" />
            Search
          </TabsTrigger>
          <TabsTrigger value="library">
            <BookOpen className="mr-2 h-4 w-4" />
            Library ({references.length})
          </TabsTrigger>
          <TabsTrigger value="selected">
            <FileText className="mr-2 h-4 w-4" />
            Selected ({selectedCount})
          </TabsTrigger>
        </TabsList>

        {/* Search Tab */}
        <TabsContent value="search" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Literature Search</CardTitle>
              <CardDescription>
                Search PubMed, Semantic Scholar, and other databases
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
                <Select value={searchSource} onValueChange={(v) => setSearchSource(v as typeof searchSource)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="pubmed">PubMed</SelectItem>
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

              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 cursor-pointer hover:bg-muted/50" onClick={() => setSearchSource('pubmed')}>
                  <div className="flex items-center gap-3">
                    <Database className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="font-medium">PubMed</p>
                      <p className="text-xs text-muted-foreground">Biomedical literature</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4 cursor-pointer hover:bg-muted/50" onClick={() => setSearchSource('semantic_scholar')}>
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-8 w-8 text-purple-600" />
                    <div>
                      <p className="font-medium">Semantic Scholar</p>
                      <p className="text-xs text-muted-foreground">AI-powered search</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4 cursor-pointer hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Plus className="h-8 w-8 text-gray-600" />
                    <div>
                      <p className="font-medium">Add Manually</p>
                      <p className="text-xs text-muted-foreground">Import DOI or BibTeX</p>
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
                  <CardTitle>Reference Library</CardTitle>
                  <CardDescription>
                    {references.length} references • {starredCount} starred • {selectedCount} selected
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilterStarred(!filterStarred)}
                  >
                    {filterStarred ? <Star className="mr-2 h-4 w-4 fill-yellow-400" /> : <StarOff className="mr-2 h-4 w-4" />}
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
                  checked={selectedCount === references.length && references.length > 0}
                  onCheckedChange={(checked) => selectAll(!!checked)}
                />
                <span className="text-sm text-muted-foreground">Select all</span>
                {selectedCount > 0 && (
                  <>
                    <Separator orientation="vertical" className="h-4 mx-2" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onExportBibtex?.(references.filter((r) => r.isSelected))}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export BibTeX
                    </Button>
                  </>
                )}
              </div>

              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {displayedReferences.map((ref) => (
                    <ReferenceCard
                      key={ref.id}
                      reference={ref}
                      onToggleStar={() => toggleStar(ref.id)}
                      onToggleSelect={() => toggleSelect(ref.id)}
                      onDelete={() => deleteReference(ref.id)}
                    />
                  ))}
                  {displayedReferences.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No references found</p>
                      <p className="text-sm">Search for literature to add references</p>
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
              <CardTitle>Selected References</CardTitle>
              <CardDescription>
                References selected for your research ({selectedCount} items)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedCount > 0 ? (
                <>
                  <div className="flex justify-end mb-4">
                    <Button
                      variant="outline"
                      onClick={() => onExportBibtex?.(references.filter((r) => r.isSelected))}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export BibTeX
                    </Button>
                  </div>
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {references
                        .filter((r) => r.isSelected)
                        .map((ref) => (
                          <ReferenceCard
                            key={ref.id}
                            reference={ref}
                            onToggleStar={() => toggleStar(ref.id)}
                            onToggleSelect={() => toggleSelect(ref.id)}
                            onDelete={() => deleteReference(ref.id)}
                          />
                        ))}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No references selected</p>
                  <p className="text-sm">Select references from your library to include in your research</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Reference Card Component
interface ReferenceCardProps {
  reference: Reference;
  onToggleStar: () => void;
  onToggleSelect: () => void;
  onDelete: () => void;
}

function ReferenceCard({
  reference,
  onToggleStar,
  onToggleSelect,
  onDelete,
}: ReferenceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const sourceColors: Record<Reference['source'], string> = {
    pubmed: 'bg-blue-100 text-blue-700',
    semantic_scholar: 'bg-purple-100 text-purple-700',
    crossref: 'bg-green-100 text-green-700',
    manual: 'bg-gray-100 text-gray-700',
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className={cn(reference.isSelected && 'ring-2 ring-primary')}>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Checkbox
              checked={reference.isSelected}
              onCheckedChange={onToggleSelect}
            />

            <div className="flex-1 min-w-0">
              <CollapsibleTrigger asChild>
                <button className="text-left w-full">
                  <h4 className="font-medium text-sm hover:text-primary transition-colors">
                    {reference.title}
                  </h4>
                </button>
              </CollapsibleTrigger>

              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span className="truncate">
                  {reference.authors.slice(0, 3).join(', ')}
                  {reference.authors.length > 3 && ' et al.'}
                </span>
                <span>•</span>
                <Calendar className="h-3 w-3" />
                <span>{reference.year}</span>
                {reference.journal && (
                  <>
                    <span>•</span>
                    <span className="truncate">{reference.journal}</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 mt-2">
                <Badge className={cn('text-xs', sourceColors[reference.source])}>
                  {reference.source.replace('_', ' ')}
                </Badge>
                {reference.citationCount !== undefined && (
                  <Badge variant="outline" className="text-xs">
                    <Quote className="mr-1 h-3 w-3" />
                    {reference.citationCount} citations
                  </Badge>
                )}
                {reference.tags.map((tag) => (
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
                    reference.isStarred && 'fill-yellow-400 text-yellow-400'
                  )}
                />
              </Button>
              {reference.doi && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  asChild
                >
                  <a
                    href={`https://doi.org/${reference.doi}`}
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
                className="h-8 w-8 text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <CollapsibleContent>
            {reference.abstract && (
              <div className="mt-4 pt-4 border-t">
                <h5 className="text-xs font-medium text-muted-foreground mb-2">Abstract</h5>
                <p className="text-sm text-muted-foreground">{reference.abstract}</p>
              </div>
            )}
            <div className="mt-4 flex gap-4 text-xs">
              {reference.doi && (
                <div>
                  <span className="font-medium">DOI:</span>{' '}
                  <a
                    href={`https://doi.org/${reference.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {reference.doi}
                  </a>
                </div>
              )}
              {reference.pmid && (
                <div>
                  <span className="font-medium">PMID:</span>{' '}
                  <a
                    href={`https://pubmed.ncbi.nlm.nih.gov/${reference.pmid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {reference.pmid}
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

export default Stage03LiteratureSearch;
