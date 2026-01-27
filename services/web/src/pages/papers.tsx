/**
 * Paper Library Page
 *
 * Track B Phase 10: Paper Library & PDF Ingestion
 *
 * Features:
 * - PDF upload with drag-and-drop
 * - Paper grid/list view
 * - Search and filter
 * - Tag management
 * - Read status tracking
 */

import { useState, useCallback, useRef, DragEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Upload,
  Search,
  Grid,
  List,
  MoreVertical,
  Trash2,
  Tag,
  Star,
  StarOff,
  BookOpen,
  Eye,
  Download,
  ExternalLink,
  Loader2,
  Plus,
  Filter,
  X,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

interface Paper {
  id: string;
  title: string;
  authors: { name: string; affiliation?: string; orcid?: string }[];
  abstract?: string;
  doi?: string;
  pmid?: string;
  year?: number;
  journal?: string;
  page_count?: number;
  word_count?: number;
  status: 'pending' | 'processing' | 'ready' | 'error';
  read_status: 'unread' | 'reading' | 'read';
  rating?: number;
  notes?: string;
  tags?: { tag: string; color: string }[];
  created_at: string;
  updated_at: string;
}

interface PaperListResponse {
  papers: Paper[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// =============================================================================
// Components
// =============================================================================

function PaperCard({ paper, onView, onDelete, onUpdateStatus }: {
  paper: Paper;
  onView: (paper: Paper) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: Paper['read_status']) => void;
}) {
  const statusColors = {
    unread: 'bg-gray-100 text-gray-700',
    reading: 'bg-blue-100 text-blue-700',
    read: 'bg-green-100 text-green-700',
  };

  const processingStatusColors = {
    pending: 'bg-yellow-100 text-yellow-700',
    processing: 'bg-blue-100 text-blue-700',
    ready: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            <h3
              className="font-medium text-sm line-clamp-2 cursor-pointer hover:text-blue-600"
              onClick={() => onView(paper)}
            >
              {paper.title}
            </h3>

            {paper.authors && paper.authors.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                {paper.authors.map(a => a.name).join(', ')}
              </p>
            )}

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {paper.year && (
                <span className="text-xs text-muted-foreground">{paper.year}</span>
              )}
              {paper.journal && (
                <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                  {paper.journal}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="outline" className={cn("text-xs", statusColors[paper.read_status])}>
                {paper.read_status}
              </Badge>

              {paper.status !== 'ready' && (
                <Badge variant="outline" className={cn("text-xs", processingStatusColors[paper.status])}>
                  {paper.status}
                </Badge>
              )}

              {paper.tags?.map(t => (
                <Badge key={t.tag} variant="secondary" className="text-xs">
                  {t.tag}
                </Badge>
              ))}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(paper)}>
                <Eye className="h-4 w-4 mr-2" />
                View
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onUpdateStatus(paper.id, 'unread')}>
                Mark as Unread
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onUpdateStatus(paper.id, 'reading')}>
                Mark as Reading
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onUpdateStatus(paper.id, 'read')}>
                Mark as Read
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {paper.doi && (
                <DropdownMenuItem asChild>
                  <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open DOI
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => onDelete(paper.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

function UploadZone({ onUpload, isUploading }: {
  onUpload: (files: File[]) => void;
  isUploading: boolean;
}) {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const files = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'application/pdf'
    );
    if (files.length > 0) {
      onUpload(files);
    }
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      onUpload(files);
    }
  };

  return (
    <div
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
        isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400",
        isUploading && "opacity-50 cursor-not-allowed"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        multiple
        onChange={handleFileChange}
        className="hidden"
        disabled={isUploading}
      />
      {isUploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
          <p className="text-sm text-muted-foreground">Uploading...</p>
        </div>
      ) : isDragActive ? (
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-10 w-10 text-blue-500" />
          <p className="text-sm text-blue-600">Drop PDF files here</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-10 w-10 text-gray-400" />
          <p className="text-sm text-muted-foreground">
            Drag & drop PDF files here, or click to browse
          </p>
          <p className="text-xs text-muted-foreground">
            Maximum file size: 50MB
          </p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function PapersPage() {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch papers
  const { data, isLoading, error } = useQuery({
    queryKey: ['papers', filterStatus],
    queryFn: () => apiRequest<PaperListResponse>('/api/papers' + (filterStatus !== 'all' ? `?read_status=${filterStatus}` : '')),
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/papers/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['papers'] });
      toast({ title: 'Paper uploaded successfully' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Paper['read_status'] }) => {
      return apiRequest(`/api/papers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ read_status: status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['papers'] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/papers/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['papers'] });
      toast({ title: 'Paper deleted' });
    },
    onError: () => {
      toast({
        title: 'Failed to delete paper',
        variant: 'destructive',
      });
    },
  });

  const handleUpload = async (files: File[]) => {
    for (const file of files) {
      await uploadMutation.mutateAsync(file);
    }
    setShowUploadDialog(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this paper?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleUpdateStatus = (id: string, status: Paper['read_status']) => {
    updateStatusMutation.mutate({ id, status });
  };

  const handleViewPaper = (paper: Paper) => {
    setSelectedPaper(paper);
    // TODO: Navigate to PDF viewer
  };

  // Filter papers by search query
  const filteredPapers = data?.papers.filter(paper => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      paper.title.toLowerCase().includes(query) ||
      paper.authors?.some(a => a.name.toLowerCase().includes(query)) ||
      paper.abstract?.toLowerCase().includes(query)
    );
  }) || [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Paper Library
          </h1>
          <p className="text-muted-foreground">
            Manage your research papers and PDFs
          </p>
        </div>

        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Paper
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload Paper</DialogTitle>
              <DialogDescription>
                Upload PDF files to your library. Metadata will be extracted automatically.
              </DialogDescription>
            </DialogHeader>
            <UploadZone
              onUpload={handleUpload}
              isUploading={uploadMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search papers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Papers</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="reading">Reading</SelectItem>
            <SelectItem value="read">Read</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center border rounded-md">
          <Button
            variant={view === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className="rounded-r-none"
            onClick={() => setView('grid')}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={view === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="rounded-l-none"
            onClick={() => setView('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{data?.pagination.total || 0} papers</span>
        <Separator orientation="vertical" className="h-4" />
        <span>{filteredPapers.filter(p => p.read_status === 'unread').length} unread</span>
        <span>{filteredPapers.filter(p => p.read_status === 'reading').length} reading</span>
        <span>{filteredPapers.filter(p => p.read_status === 'read').length} read</span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card className="p-8 text-center">
          <p className="text-red-500">Failed to load papers</p>
        </Card>
      ) : filteredPapers.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">No papers yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upload your first paper to get started
          </p>
          <Button onClick={() => setShowUploadDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Paper
          </Button>
        </Card>
      ) : (
        <div className={cn(
          view === 'grid'
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            : "space-y-2"
        )}>
          {filteredPapers.map((paper) => (
            <PaperCard
              key={paper.id}
              paper={paper}
              onView={handleViewPaper}
              onDelete={handleDelete}
              onUpdateStatus={handleUpdateStatus}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.pagination.hasMore && (
        <div className="flex justify-center pt-4">
          <Button variant="outline">Load more</Button>
        </div>
      )}
    </div>
  );
}
