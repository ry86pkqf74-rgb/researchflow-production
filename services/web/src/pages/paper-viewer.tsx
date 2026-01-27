/**
 * Paper Viewer Page
 *
 * Track B Phase 11: PDF Viewer with Annotations
 *
 * Features:
 * - PDF rendering with pdf.js
 * - Text selection for highlights
 * - Annotation overlay layer
 * - Annotation sidebar
 * - Page navigation
 * - Zoom controls
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Highlighter,
  MessageSquare,
  Trash2,
  MoreVertical,
  Loader2,
  ArrowLeft,
  Download,
  StickyNote,
  Palette,
  X,
  Check,
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
  authors: { name: string }[];
  pdf_path: string;
  page_count?: number;
}

interface Annotation {
  id: string;
  page_number: number;
  rect: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
  type: 'highlight' | 'underline' | 'strikethrough' | 'note';
  color: string;
  selected_text?: string;
  note_content?: string;
  created_at: string;
}

interface AnnotationListResponse {
  annotations: Annotation[];
  paper_id: string;
}

// Color options for annotations
const HIGHLIGHT_COLORS = [
  { name: 'yellow', class: 'bg-yellow-200/70', border: 'border-yellow-400' },
  { name: 'green', class: 'bg-green-200/70', border: 'border-green-400' },
  { name: 'blue', class: 'bg-blue-200/70', border: 'border-blue-400' },
  { name: 'pink', class: 'bg-pink-200/70', border: 'border-pink-400' },
  { name: 'orange', class: 'bg-orange-200/70', border: 'border-orange-400' },
];

// =============================================================================
// Components
// =============================================================================

function AnnotationOverlay({
  annotation,
  containerWidth,
  containerHeight,
  onSelect,
  isSelected,
}: {
  annotation: Annotation;
  containerWidth: number;
  containerHeight: number;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const colorClass = HIGHLIGHT_COLORS.find(c => c.name === annotation.color)?.class || 'bg-yellow-200/70';
  const borderClass = HIGHLIGHT_COLORS.find(c => c.name === annotation.color)?.border || 'border-yellow-400';

  const style = {
    left: `${annotation.rect.x1 * 100}%`,
    top: `${annotation.rect.y1 * 100}%`,
    width: `${(annotation.rect.x2 - annotation.rect.x1) * 100}%`,
    height: `${(annotation.rect.y2 - annotation.rect.y1) * 100}%`,
  };

  return (
    <div
      className={cn(
        "absolute cursor-pointer transition-all",
        colorClass,
        isSelected && `ring-2 ${borderClass}`,
        annotation.type === 'underline' && "h-[3px] rounded-none",
        annotation.type === 'strikethrough' && "h-[2px] rounded-none top-1/2 -translate-y-1/2"
      )}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {annotation.note_content && (
        <div className="absolute -top-1 -right-1">
          <StickyNote className="h-3 w-3 text-orange-500" />
        </div>
      )}
    </div>
  );
}

function AnnotationSidebar({
  annotations,
  selectedId,
  onSelect,
  onDelete,
  currentPage,
}: {
  annotations: Annotation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  currentPage: number;
}) {
  const pageAnnotations = annotations.filter(a => a.page_number === currentPage);
  const otherAnnotations = annotations.filter(a => a.page_number !== currentPage);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h3 className="font-medium">Annotations</h3>
        <p className="text-xs text-muted-foreground mt-1">
          {annotations.length} total, {pageAnnotations.length} on this page
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {pageAnnotations.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">
                Page {currentPage}
              </h4>
              <div className="space-y-2">
                {pageAnnotations.map((annotation) => (
                  <Card
                    key={annotation.id}
                    className={cn(
                      "p-3 cursor-pointer hover:bg-accent transition-colors",
                      selectedId === annotation.id && "ring-2 ring-primary"
                    )}
                    onClick={() => onSelect(annotation.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {annotation.type}
                          </Badge>
                          <div
                            className={cn(
                              "w-3 h-3 rounded-full",
                              HIGHLIGHT_COLORS.find(c => c.name === annotation.color)?.class
                            )}
                          />
                        </div>
                        {annotation.selected_text && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            "{annotation.selected_text}"
                          </p>
                        )}
                        {annotation.note_content && (
                          <p className="text-xs mt-1 line-clamp-2">
                            {annotation.note_content}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(annotation.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {otherAnnotations.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">
                Other Pages
              </h4>
              <div className="space-y-2">
                {otherAnnotations.slice(0, 10).map((annotation) => (
                  <Card
                    key={annotation.id}
                    className="p-2 cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => onSelect(annotation.id)}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        p.{annotation.page_number}
                      </Badge>
                      <span className="text-xs text-muted-foreground truncate">
                        {annotation.selected_text?.slice(0, 30) || annotation.note_content?.slice(0, 30) || annotation.type}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {annotations.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Highlighter className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No annotations yet</p>
              <p className="text-xs mt-1">
                Select text to create a highlight
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function PaperViewerPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [highlightMode, setHighlightMode] = useState(false);
  const [selectedColor, setSelectedColor] = useState('yellow');
  const [showSidebar, setShowSidebar] = useState(true);
  const [pendingHighlight, setPendingHighlight] = useState<{
    text: string;
    rect: { x1: number; y1: number; x2: number; y2: number };
  } | null>(null);
  const [noteText, setNoteText] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch paper
  const { data: paper, isLoading: paperLoading } = useQuery({
    queryKey: ['paper', id],
    queryFn: () => apiRequest<Paper>(`/api/papers/${id}`),
    enabled: !!id,
  });

  // Fetch annotations
  const { data: annotationsData } = useQuery({
    queryKey: ['paper-annotations', id],
    queryFn: () => apiRequest<AnnotationListResponse>(`/api/papers/${id}/annotations`),
    enabled: !!id,
  });

  const annotations = annotationsData?.annotations || [];

  // Create annotation mutation
  const createAnnotationMutation = useMutation({
    mutationFn: (data: Omit<Annotation, 'id' | 'created_at'>) =>
      apiRequest(`/api/papers/${id}/annotations`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paper-annotations', id] });
      setPendingHighlight(null);
      setNoteText('');
      toast({ title: 'Annotation created' });
    },
    onError: () => {
      toast({ title: 'Failed to create annotation', variant: 'destructive' });
    },
  });

  // Delete annotation mutation
  const deleteAnnotationMutation = useMutation({
    mutationFn: (annotationId: string) =>
      apiRequest(`/api/papers/${id}/annotations/${annotationId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paper-annotations', id] });
      setSelectedAnnotationId(null);
      toast({ title: 'Annotation deleted' });
    },
  });

  // Handle text selection for highlights
  const handleTextSelection = useCallback(() => {
    if (!highlightMode) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    if (!text) return;

    const range = selection.getRangeAt(0);
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const rangeRect = range.getBoundingClientRect();

    // Calculate normalized coordinates
    const rect = {
      x1: (rangeRect.left - containerRect.left) / containerRect.width,
      y1: (rangeRect.top - containerRect.top) / containerRect.height,
      x2: (rangeRect.right - containerRect.left) / containerRect.width,
      y2: (rangeRect.bottom - containerRect.top) / containerRect.height,
    };

    setPendingHighlight({ text, rect });
    selection.removeAllRanges();
  }, [highlightMode]);

  const handleCreateHighlight = () => {
    if (!pendingHighlight) return;

    createAnnotationMutation.mutate({
      page_number: currentPage,
      rect: pendingHighlight.rect,
      type: 'highlight',
      color: selectedColor,
      selected_text: pendingHighlight.text,
      note_content: noteText || undefined,
    });
  };

  const handleDeleteAnnotation = (annotationId: string) => {
    if (confirm('Delete this annotation?')) {
      deleteAnnotationMutation.mutate(annotationId);
    }
  };

  // Navigate to annotation
  const handleSelectAnnotation = (annotationId: string) => {
    const annotation = annotations.find(a => a.id === annotationId);
    if (annotation && annotation.page_number !== currentPage) {
      setCurrentPage(annotation.page_number);
    }
    setSelectedAnnotationId(annotationId);
  };

  // Page annotations
  const pageAnnotations = annotations.filter(a => a.page_number === currentPage);

  if (paperLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-muted-foreground mb-4">Paper not found</p>
        <Button onClick={() => setLocation('/papers')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Library
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Toolbar */}
      <div className="border-b bg-background p-2 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setLocation('/papers')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-medium truncate">{paper.title}</h1>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="number"
            min={1}
            max={totalPages}
            value={currentPage}
            onChange={(e) => setCurrentPage(Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1)))}
            className="w-14 h-8 text-center"
          />
          <span className="text-sm text-muted-foreground">/ {totalPages}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm w-14 text-center">{Math.round(zoom * 100)}%</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setZoom(z => Math.min(2, z + 0.1))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Highlight mode */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={highlightMode ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setHighlightMode(!highlightMode)}
            >
              <Highlighter className="h-4 w-4 mr-2" />
              Highlight
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {highlightMode ? 'Click to disable highlight mode' : 'Enable highlight mode to select text'}
          </TooltipContent>
        </Tooltip>

        {highlightMode && (
          <Select value={selectedColor} onValueChange={setSelectedColor}>
            <SelectTrigger className="w-[100px] h-8">
              <div className="flex items-center gap-2">
                <div className={cn("w-4 h-4 rounded", HIGHLIGHT_COLORS.find(c => c.name === selectedColor)?.class)} />
                <span className="capitalize">{selectedColor}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {HIGHLIGHT_COLORS.map((color) => (
                <SelectItem key={color.name} value={color.name}>
                  <div className="flex items-center gap-2">
                    <div className={cn("w-4 h-4 rounded", color.class)} />
                    <span className="capitalize">{color.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Separator orientation="vertical" className="h-6" />

        {/* Sidebar toggle */}
        <Button
          variant={showSidebar ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setShowSidebar(!showSidebar)}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          {annotations.length > 0 && <Badge variant="secondary" className="ml-1">{annotations.length}</Badge>}
        </Button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* PDF viewer area */}
        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          <div
            ref={containerRef}
            className="relative mx-auto bg-white shadow-lg"
            style={{
              width: `${zoom * 100}%`,
              maxWidth: '900px',
              minHeight: '1000px',
            }}
            onMouseUp={handleTextSelection}
          >
            {/* PDF content placeholder - in real implementation, use pdf.js */}
            <div className="p-8 text-center text-muted-foreground">
              <p className="mb-4">PDF Viewer</p>
              <p className="text-sm">Page {currentPage} of {paper.page_count || '?'}</p>
              <p className="text-xs mt-4">
                PDF rendering with pdf.js would be implemented here.
                <br />
                For now, this is a placeholder showing the annotation overlay system.
              </p>
            </div>

            {/* Annotation overlays */}
            {pageAnnotations.map((annotation) => (
              <AnnotationOverlay
                key={annotation.id}
                annotation={annotation}
                containerWidth={900}
                containerHeight={1000}
                onSelect={() => setSelectedAnnotationId(annotation.id)}
                isSelected={selectedAnnotationId === annotation.id}
              />
            ))}
          </div>
        </div>

        {/* Sidebar */}
        {showSidebar && (
          <div className="w-80 border-l bg-background">
            <AnnotationSidebar
              annotations={annotations}
              selectedId={selectedAnnotationId}
              onSelect={handleSelectAnnotation}
              onDelete={handleDeleteAnnotation}
              currentPage={currentPage}
            />
          </div>
        )}
      </div>

      {/* Pending highlight dialog */}
      {pendingHighlight && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96 p-4">
            <h3 className="font-medium mb-2">Create Highlight</h3>
            <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
              "{pendingHighlight.text}"
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Color</label>
                <div className="flex gap-2">
                  {HIGHLIGHT_COLORS.map((color) => (
                    <button
                      key={color.name}
                      className={cn(
                        "w-8 h-8 rounded-full transition-all",
                        color.class,
                        selectedColor === color.name && "ring-2 ring-offset-2 ring-primary"
                      )}
                      onClick={() => setSelectedColor(color.name)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Note (optional)</label>
                <Textarea
                  placeholder="Add a note..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setPendingHighlight(null);
                    setNoteText('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateHighlight}
                  disabled={createAnnotationMutation.isPending}
                >
                  {createAnnotationMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Create
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
