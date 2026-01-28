/**
 * Stage 09 - Interpretation
 * Collaborate on interpreting results
 * Features: Results artifact viewer, thread-based discussions, AI-assisted interpretation,
 * annotation tools, key findings summary, collaborator mentions, export
 */

import * as React from 'react';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  RefreshCcw,
  Download,
  FileText,
  Image,
  Table2,
  ChevronDown,
  ChevronRight,
  Reply,
  AtSign,
  Pin,
  PinOff,
  CheckCircle,
  Circle,
  Send,
  Eye,
  EyeOff,
  MoreVertical,
  Flag,
  Bookmark,
  BookmarkCheck,
  Highlighter,
  MessageCircle,
  Copy,
  ExternalLink,
  User,
  Users,
  Clock,
  Filter,
  SortAsc,
  ListFilter,
  FileJson,
  FileDown,
  Lightbulb,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  Move,
  Square,
  Type,
  Pencil,
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ModelTierSelect, type ModelTier } from '@/components/ai';

// ============================================================================
// Types
// ============================================================================

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: 'owner' | 'editor' | 'commenter' | 'viewer';
}

export interface Annotation {
  id: string;
  artifactId: string;
  type: 'highlight' | 'box' | 'text' | 'arrow';
  position: {
    x: number;
    y: number;
    width?: number;
    height?: number;
    endX?: number;
    endY?: number;
  };
  color: string;
  label?: string;
  createdBy: string;
  createdAt: Date;
}

export interface Comment {
  id: string;
  artifactId?: string;
  annotationId?: string;
  parentId?: string;
  content: string;
  mentions: string[];
  author: Collaborator;
  isResolved: boolean;
  isPinned: boolean;
  reactions: Array<{ emoji: string; userIds: string[] }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentThread {
  id: string;
  rootComment: Comment;
  replies: Comment[];
  artifactId?: string;
  annotationId?: string;
  isExpanded: boolean;
}

export interface ResultArtifact {
  id: string;
  name: string;
  type: 'figure' | 'table' | 'chart' | 'summary' | 'data';
  description?: string;
  sourceStage: number;
  content?: string;
  imageUrl?: string;
  tableData?: Array<Record<string, unknown>>;
  annotations: Annotation[];
  commentCount: number;
  isBookmarked: boolean;
  createdAt: Date;
}

export interface KeyFinding {
  id: string;
  title: string;
  description: string;
  supportingArtifacts: string[];
  significance: 'high' | 'medium' | 'low';
  confidence: 'high' | 'medium' | 'low';
  aiGenerated: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InterpretationSuggestion {
  id: string;
  type: 'insight' | 'question' | 'concern' | 'recommendation';
  content: string;
  relatedArtifactIds: string[];
  isAccepted: boolean;
  isDismissed: boolean;
  createdAt: Date;
}

export interface InterpretationDocument {
  id: string;
  title: string;
  sections: Array<{
    id: string;
    heading: string;
    content: string;
  }>;
  keyFindings: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Props
// ============================================================================

interface Stage09Props {
  artifacts: ResultArtifact[];
  onArtifactsChange: (artifacts: ResultArtifact[]) => void;
  threads: CommentThread[];
  onThreadsChange: (threads: CommentThread[]) => void;
  keyFindings: KeyFinding[];
  onKeyFindingsChange: (findings: KeyFinding[]) => void;
  collaborators: Collaborator[];
  currentUser: Collaborator;
  modelTier: ModelTier;
  onModelTierChange: (tier: ModelTier) => void;
  onGenerateInterpretation?: (artifacts: ResultArtifact[]) => Promise<InterpretationSuggestion[]>;
  onGenerateSummary?: (findings: KeyFinding[]) => Promise<string>;
  onExportDocument?: (doc: InterpretationDocument) => Promise<void>;
  isGenerating?: boolean;
  className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function Stage09Interpretation({
  artifacts,
  onArtifactsChange,
  threads,
  onThreadsChange,
  keyFindings,
  onKeyFindingsChange,
  collaborators,
  currentUser,
  modelTier,
  onModelTierChange,
  onGenerateInterpretation,
  onGenerateSummary,
  onExportDocument,
  isGenerating = false,
  className,
}: Stage09Props) {
  const [selectedTab, setSelectedTab] = useState('artifacts');
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(
    artifacts[0]?.id || null
  );
  const [filterType, setFilterType] = useState<'all' | ResultArtifact['type']>('all');
  const [showResolved, setShowResolved] = useState(false);
  const [suggestions, setSuggestions] = useState<InterpretationSuggestion[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [editingFindingId, setEditingFindingId] = useState<string | null>(null);
  const [editingFindingText, setEditingFindingText] = useState<{
    title: string;
    description: string;
  }>({ title: '', description: '' });
  const [annotationTool, setAnnotationTool] = useState<Annotation['type'] | null>(null);
  const [selectedColor, setSelectedColor] = useState('#3b82f6');
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const selectedArtifact = artifacts.find((a) => a.id === selectedArtifactId);

  // Filter artifacts
  const displayedArtifacts = useMemo(() => {
    if (filterType === 'all') return artifacts;
    return artifacts.filter((a) => a.type === filterType);
  }, [artifacts, filterType]);

  // Filter threads for current artifact
  const artifactThreads = useMemo(() => {
    if (!selectedArtifactId) return [];
    return threads.filter(
      (t) =>
        t.artifactId === selectedArtifactId &&
        (showResolved || !t.rootComment.isResolved)
    );
  }, [threads, selectedArtifactId, showResolved]);

  // Generate AI interpretation suggestions
  const handleGenerateInterpretation = useCallback(async () => {
    if (!onGenerateInterpretation) return;
    const newSuggestions = await onGenerateInterpretation(artifacts);
    setSuggestions(newSuggestions);
  }, [onGenerateInterpretation, artifacts]);

  // Add comment
  const handleAddComment = useCallback(
    (artifactId: string, parentId?: string, annotationId?: string) => {
      if (!newCommentText.trim()) return;

      // Extract mentions
      const mentionRegex = /@(\w+)/g;
      const mentions: string[] = [];
      let match: RegExpExecArray | null;
      while ((match = mentionRegex.exec(newCommentText)) !== null) {
        const collaborator = collaborators.find(
          (c) => c.name.toLowerCase().includes(match![1].toLowerCase())
        );
        if (collaborator) mentions.push(collaborator.id);
      }

      const newComment: Comment = {
        id: crypto.randomUUID(),
        artifactId,
        annotationId,
        parentId,
        content: newCommentText,
        mentions,
        author: currentUser,
        isResolved: false,
        isPinned: false,
        reactions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (parentId) {
        // Add as reply to existing thread
        onThreadsChange(
          threads.map((t) =>
            t.id === parentId || t.rootComment.id === parentId
              ? { ...t, replies: [...t.replies, newComment] }
              : t
          )
        );
      } else {
        // Create new thread
        const newThread: CommentThread = {
          id: crypto.randomUUID(),
          rootComment: newComment,
          replies: [],
          artifactId,
          annotationId,
          isExpanded: true,
        };
        onThreadsChange([...threads, newThread]);
      }

      setNewCommentText('');
      setReplyingToId(null);
    },
    [newCommentText, currentUser, collaborators, threads, onThreadsChange]
  );

  // Toggle thread resolved
  const toggleThreadResolved = useCallback(
    (threadId: string) => {
      onThreadsChange(
        threads.map((t) =>
          t.id === threadId
            ? {
                ...t,
                rootComment: {
                  ...t.rootComment,
                  isResolved: !t.rootComment.isResolved,
                  updatedAt: new Date(),
                },
              }
            : t
        )
      );
    },
    [threads, onThreadsChange]
  );

  // Toggle thread pinned
  const toggleThreadPinned = useCallback(
    (threadId: string) => {
      onThreadsChange(
        threads.map((t) =>
          t.id === threadId
            ? {
                ...t,
                rootComment: {
                  ...t.rootComment,
                  isPinned: !t.rootComment.isPinned,
                  updatedAt: new Date(),
                },
              }
            : t
        )
      );
    },
    [threads, onThreadsChange]
  );

  // Delete thread
  const deleteThread = useCallback(
    (threadId: string) => {
      onThreadsChange(threads.filter((t) => t.id !== threadId));
    },
    [threads, onThreadsChange]
  );

  // Toggle artifact bookmark
  const toggleBookmark = useCallback(
    (artifactId: string) => {
      onArtifactsChange(
        artifacts.map((a) =>
          a.id === artifactId ? { ...a, isBookmarked: !a.isBookmarked } : a
        )
      );
    },
    [artifacts, onArtifactsChange]
  );

  // Add annotation
  const addAnnotation = useCallback(
    (artifactId: string, annotation: Omit<Annotation, 'id' | 'createdAt' | 'createdBy'>) => {
      const newAnnotation: Annotation = {
        ...annotation,
        id: crypto.randomUUID(),
        createdBy: currentUser.id,
        createdAt: new Date(),
      };
      onArtifactsChange(
        artifacts.map((a) =>
          a.id === artifactId
            ? { ...a, annotations: [...a.annotations, newAnnotation] }
            : a
        )
      );
    },
    [artifacts, onArtifactsChange, currentUser.id]
  );

  // Delete annotation
  const deleteAnnotation = useCallback(
    (artifactId: string, annotationId: string) => {
      onArtifactsChange(
        artifacts.map((a) =>
          a.id === artifactId
            ? { ...a, annotations: a.annotations.filter((an) => an.id !== annotationId) }
            : a
        )
      );
    },
    [artifacts, onArtifactsChange]
  );

  // Add key finding
  const addKeyFinding = useCallback(() => {
    const newFinding: KeyFinding = {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      supportingArtifacts: selectedArtifactId ? [selectedArtifactId] : [],
      significance: 'medium',
      confidence: 'medium',
      aiGenerated: false,
      createdBy: currentUser.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    onKeyFindingsChange([...keyFindings, newFinding]);
    setEditingFindingId(newFinding.id);
    setEditingFindingText({ title: '', description: '' });
  }, [keyFindings, onKeyFindingsChange, currentUser.id, selectedArtifactId]);

  // Update key finding
  const updateKeyFinding = useCallback(
    (id: string, updates: Partial<KeyFinding>) => {
      onKeyFindingsChange(
        keyFindings.map((f) =>
          f.id === id ? { ...f, ...updates, updatedAt: new Date() } : f
        )
      );
    },
    [keyFindings, onKeyFindingsChange]
  );

  // Delete key finding
  const deleteKeyFinding = useCallback(
    (id: string) => {
      onKeyFindingsChange(keyFindings.filter((f) => f.id !== id));
    },
    [keyFindings, onKeyFindingsChange]
  );

  // Save key finding edit
  const saveKeyFindingEdit = useCallback(() => {
    if (editingFindingId && editingFindingText.title.trim()) {
      updateKeyFinding(editingFindingId, {
        title: editingFindingText.title.trim(),
        description: editingFindingText.description.trim(),
      });
    }
    setEditingFindingId(null);
    setEditingFindingText({ title: '', description: '' });
  }, [editingFindingId, editingFindingText, updateKeyFinding]);

  // Accept suggestion
  const acceptSuggestion = useCallback(
    (suggestionId: string) => {
      const suggestion = suggestions.find((s) => s.id === suggestionId);
      if (suggestion && suggestion.type === 'insight') {
        const newFinding: KeyFinding = {
          id: crypto.randomUUID(),
          title: suggestion.content.slice(0, 50) + (suggestion.content.length > 50 ? '...' : ''),
          description: suggestion.content,
          supportingArtifacts: suggestion.relatedArtifactIds,
          significance: 'medium',
          confidence: 'medium',
          aiGenerated: true,
          createdBy: 'ai',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        onKeyFindingsChange([...keyFindings, newFinding]);
      }
      setSuggestions(
        suggestions.map((s) =>
          s.id === suggestionId ? { ...s, isAccepted: true } : s
        )
      );
    },
    [suggestions, keyFindings, onKeyFindingsChange]
  );

  // Dismiss suggestion
  const dismissSuggestion = useCallback((suggestionId: string) => {
    setSuggestions(
      suggestions.map((s) =>
        s.id === suggestionId ? { ...s, isDismissed: true } : s
      )
    );
  }, [suggestions]);

  // Export interpretation document
  const handleExportDocument = useCallback(async () => {
    if (!onExportDocument) return;

    const doc: InterpretationDocument = {
      id: crypto.randomUUID(),
      title: 'Research Interpretation Summary',
      sections: [
        {
          id: '1',
          heading: 'Key Findings',
          content: keyFindings
            .map((f) => `### ${f.title}\n\n${f.description}`)
            .join('\n\n'),
        },
        {
          id: '2',
          heading: 'Discussion Threads',
          content: threads
            .filter((t) => t.rootComment.isPinned)
            .map((t) => `**${t.rootComment.author.name}:** ${t.rootComment.content}`)
            .join('\n\n'),
        },
      ],
      keyFindings: keyFindings.map((f) => f.id),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await onExportDocument(doc);
  }, [onExportDocument, keyFindings, threads]);

  // Handle mention insertion
  const insertMention = useCallback(
    (collaborator: Collaborator) => {
      const mention = `@${collaborator.name} `;
      setNewCommentText((prev) => {
        const beforeMention = prev.slice(0, prev.lastIndexOf('@'));
        return beforeMention + mention;
      });
      setShowMentionPopover(false);
      setMentionSearch('');
      commentInputRef.current?.focus();
    },
    []
  );

  // Filtered collaborators for mention
  const filteredCollaborators = useMemo(() => {
    if (!mentionSearch) return collaborators;
    return collaborators.filter((c) =>
      c.name.toLowerCase().includes(mentionSearch.toLowerCase())
    );
  }, [collaborators, mentionSearch]);

  // Handle comment input change with mention detection
  const handleCommentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setNewCommentText(value);

      // Check for mention trigger
      const lastAtIndex = value.lastIndexOf('@');
      if (lastAtIndex !== -1 && lastAtIndex === value.length - 1) {
        setShowMentionPopover(true);
        setMentionSearch('');
      } else if (lastAtIndex !== -1) {
        const textAfterAt = value.slice(lastAtIndex + 1);
        if (!textAfterAt.includes(' ')) {
          setShowMentionPopover(true);
          setMentionSearch(textAfterAt);
        } else {
          setShowMentionPopover(false);
        }
      } else {
        setShowMentionPopover(false);
      }
    },
    []
  );

  const activeSuggestions = suggestions.filter((s) => !s.isAccepted && !s.isDismissed);
  const pinnedThreads = threads.filter((t) => t.rootComment.isPinned);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with AI controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Results Interpretation
              </CardTitle>
              <CardDescription>
                Collaborate on interpreting results, add annotations, and document key findings
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-48">
                <Label className="text-xs mb-1">AI Model</Label>
                <ModelTierSelect value={modelTier} onChange={onModelTierChange} />
              </div>
              <Button
                onClick={handleGenerateInterpretation}
                disabled={isGenerating || artifacts.length === 0}
              >
                {isGenerating ? (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Get AI Insights
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* AI Suggestions Panel */}
      {activeSuggestions.length > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              AI Interpretation Suggestions ({activeSuggestions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-2">
                {activeSuggestions.map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    onAccept={() => acceptSuggestion(suggestion.id)}
                    onDismiss={() => dismissSuggestion(suggestion.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="artifacts">
            <Image className="mr-2 h-4 w-4" />
            Artifacts ({artifacts.length})
          </TabsTrigger>
          <TabsTrigger value="discussions">
            <MessageCircle className="mr-2 h-4 w-4" />
            Discussions ({threads.length})
          </TabsTrigger>
          <TabsTrigger value="findings">
            <Lightbulb className="mr-2 h-4 w-4" />
            Key Findings ({keyFindings.length})
          </TabsTrigger>
          <TabsTrigger value="export">
            <FileDown className="mr-2 h-4 w-4" />
            Export
          </TabsTrigger>
        </TabsList>

        {/* Artifacts Tab */}
        <TabsContent value="artifacts" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Artifact List */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Result Artifacts</CardTitle>
                  <Select
                    value={filterType}
                    onValueChange={(v) => setFilterType(v as typeof filterType)}
                  >
                    <SelectTrigger className="w-28 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="figure">Figures</SelectItem>
                      <SelectItem value="table">Tables</SelectItem>
                      <SelectItem value="chart">Charts</SelectItem>
                      <SelectItem value="summary">Summaries</SelectItem>
                      <SelectItem value="data">Data</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {displayedArtifacts.map((artifact) => (
                      <ArtifactListItem
                        key={artifact.id}
                        artifact={artifact}
                        isSelected={selectedArtifactId === artifact.id}
                        onSelect={() => setSelectedArtifactId(artifact.id)}
                        onToggleBookmark={() => toggleBookmark(artifact.id)}
                      />
                    ))}
                    {displayedArtifacts.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No artifacts found</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Artifact Viewer */}
            <Card className="lg:col-span-2">
              {selectedArtifact ? (
                <>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{selectedArtifact.name}</CardTitle>
                        <CardDescription>
                          Stage {selectedArtifact.sourceStage} -{' '}
                          {selectedArtifact.annotations.length} annotations
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Annotation Tools */}
                        <TooltipProvider>
                          <div className="flex items-center border rounded-md">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={annotationTool === 'highlight' ? 'secondary' : 'ghost'}
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() =>
                                    setAnnotationTool(
                                      annotationTool === 'highlight' ? null : 'highlight'
                                    )
                                  }
                                >
                                  <Highlighter className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Highlight</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={annotationTool === 'box' ? 'secondary' : 'ghost'}
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() =>
                                    setAnnotationTool(annotationTool === 'box' ? null : 'box')
                                  }
                                >
                                  <Square className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Box</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={annotationTool === 'text' ? 'secondary' : 'ghost'}
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() =>
                                    setAnnotationTool(annotationTool === 'text' ? null : 'text')
                                  }
                                >
                                  <Type className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Text Note</TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>

                        {/* Color Picker */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8">
                              <div
                                className="h-4 w-4 rounded-full border"
                                style={{ backgroundColor: selectedColor }}
                              />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-2">
                            <div className="flex gap-1">
                              {['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6'].map(
                                (color) => (
                                  <button
                                    key={color}
                                    className={cn(
                                      'h-6 w-6 rounded-full border-2',
                                      selectedColor === color
                                        ? 'border-foreground'
                                        : 'border-transparent'
                                    )}
                                    style={{ backgroundColor: color }}
                                    onClick={() => setSelectedColor(color)}
                                  />
                                )
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ArtifactViewer
                      artifact={selectedArtifact}
                      annotationTool={annotationTool}
                      selectedColor={selectedColor}
                      onAddAnnotation={(annotation) =>
                        addAnnotation(selectedArtifact.id, annotation)
                      }
                      onDeleteAnnotation={(annotationId) =>
                        deleteAnnotation(selectedArtifact.id, annotationId)
                      }
                    />
                  </CardContent>
                </>
              ) : (
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Eye className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Select an artifact to view</p>
                </CardContent>
              )}
            </Card>
          </div>

          {/* Comments for Selected Artifact */}
          {selectedArtifact && (
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Discussion ({artifactThreads.length} threads)
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowResolved(!showResolved)}
                    >
                      {showResolved ? (
                        <EyeOff className="mr-2 h-4 w-4" />
                      ) : (
                        <Eye className="mr-2 h-4 w-4" />
                      )}
                      {showResolved ? 'Hide Resolved' : 'Show Resolved'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* New Comment */}
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={currentUser.avatarUrl} />
                      <AvatarFallback>
                        {currentUser.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <Popover open={showMentionPopover} onOpenChange={setShowMentionPopover}>
                        <PopoverTrigger asChild>
                          <Textarea
                            ref={commentInputRef}
                            placeholder="Add a comment... Use @ to mention collaborators"
                            value={newCommentText}
                            onChange={handleCommentChange}
                            rows={2}
                          />
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0" align="start">
                          <div className="p-2 border-b">
                            <p className="text-xs text-muted-foreground">Mention a collaborator</p>
                          </div>
                          <ScrollArea className="max-h-[200px]">
                            {filteredCollaborators.map((collaborator) => (
                              <button
                                key={collaborator.id}
                                className="flex items-center gap-2 w-full p-2 hover:bg-muted text-left"
                                onClick={() => insertMention(collaborator)}
                              >
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={collaborator.avatarUrl} />
                                  <AvatarFallback>
                                    {collaborator.name.slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">{collaborator.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {collaborator.email}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => handleAddComment(selectedArtifact.id)}
                          disabled={!newCommentText.trim()}
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Comment
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Thread List */}
                  <ScrollArea className="max-h-[400px]">
                    <div className="space-y-4">
                      {artifactThreads.map((thread) => (
                        <ThreadCard
                          key={thread.id}
                          thread={thread}
                          currentUserId={currentUser.id}
                          onReply={(content) => {
                            setNewCommentText(content);
                            setReplyingToId(thread.id);
                          }}
                          onToggleResolved={() => toggleThreadResolved(thread.id)}
                          onTogglePinned={() => toggleThreadPinned(thread.id)}
                          onDelete={() => deleteThread(thread.id)}
                        />
                      ))}
                      {artifactThreads.length === 0 && (
                        <div className="text-center py-4 text-muted-foreground">
                          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No discussions yet</p>
                          <p className="text-xs">Start a conversation about this artifact</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Discussions Tab */}
        <TabsContent value="discussions" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pinned Threads */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Pin className="h-4 w-4" />
                  Pinned Discussions ({pinnedThreads.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {pinnedThreads.map((thread) => (
                      <ThreadCard
                        key={thread.id}
                        thread={thread}
                        currentUserId={currentUser.id}
                        showArtifactLink
                        artifacts={artifacts}
                        onReply={() => {}}
                        onToggleResolved={() => toggleThreadResolved(thread.id)}
                        onTogglePinned={() => toggleThreadPinned(thread.id)}
                        onDelete={() => deleteThread(thread.id)}
                      />
                    ))}
                    {pinnedThreads.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Pin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No pinned discussions</p>
                        <p className="text-sm">Pin important threads to highlight them</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* All Threads */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">All Discussions</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowResolved(!showResolved)}
                  >
                    {showResolved ? 'Hide Resolved' : 'Show Resolved'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {threads
                      .filter((t) => showResolved || !t.rootComment.isResolved)
                      .map((thread) => (
                        <ThreadCard
                          key={thread.id}
                          thread={thread}
                          currentUserId={currentUser.id}
                          showArtifactLink
                          artifacts={artifacts}
                          onReply={() => {}}
                          onToggleResolved={() => toggleThreadResolved(thread.id)}
                          onTogglePinned={() => toggleThreadPinned(thread.id)}
                          onDelete={() => deleteThread(thread.id)}
                        />
                      ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Key Findings Tab */}
        <TabsContent value="findings" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Key Findings</CardTitle>
                  <CardDescription>
                    Document and organize the key findings from your results interpretation
                  </CardDescription>
                </div>
                <Button onClick={addKeyFinding}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Finding
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {keyFindings.length > 0 ? (
                <div className="space-y-4">
                  {keyFindings.map((finding) => (
                    <KeyFindingCard
                      key={finding.id}
                      finding={finding}
                      artifacts={artifacts}
                      isEditing={editingFindingId === finding.id}
                      editText={editingFindingText}
                      onEditTextChange={setEditingFindingText}
                      onStartEdit={() => {
                        setEditingFindingId(finding.id);
                        setEditingFindingText({
                          title: finding.title,
                          description: finding.description,
                        });
                      }}
                      onSaveEdit={saveKeyFindingEdit}
                      onCancelEdit={() => {
                        setEditingFindingId(null);
                        setEditingFindingText({ title: '', description: '' });
                      }}
                      onUpdate={(updates) => updateKeyFinding(finding.id, updates)}
                      onDelete={() => deleteKeyFinding(finding.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No key findings documented yet</p>
                  <p className="text-sm mb-4">
                    Add findings manually or use AI to generate insights
                  </p>
                  <div className="flex justify-center gap-2">
                    <Button variant="outline" onClick={addKeyFinding}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Manually
                    </Button>
                    <Button onClick={handleGenerateInterpretation} disabled={isGenerating}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate with AI
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Export Tab */}
        <TabsContent value="export" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Export Interpretation Document</CardTitle>
              <CardDescription>
                Generate and export a comprehensive interpretation document
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4">
                  <h4 className="font-medium mb-2">Summary Statistics</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Artifacts reviewed</span>
                      <span>{artifacts.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total annotations</span>
                      <span>
                        {artifacts.reduce((sum, a) => sum + a.annotations.length, 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Discussion threads</span>
                      <span>{threads.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Key findings</span>
                      <span>{keyFindings.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Resolved discussions</span>
                      <span>{threads.filter((t) => t.rootComment.isResolved).length}</span>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <h4 className="font-medium mb-2">Collaborators</h4>
                  <div className="space-y-2">
                    {collaborators.slice(0, 5).map((collaborator) => (
                      <div key={collaborator.id} className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={collaborator.avatarUrl} />
                          <AvatarFallback>
                            {collaborator.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{collaborator.name}</span>
                        <Badge variant="secondary" className="text-xs ml-auto">
                          {collaborator.role}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">Export Options</h4>
                <div className="grid grid-cols-3 gap-4">
                  <Button variant="outline" className="h-auto py-4" onClick={handleExportDocument}>
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-8 w-8" />
                      <span>Markdown</span>
                      <span className="text-xs text-muted-foreground">interpretation.md</span>
                    </div>
                  </Button>
                  <Button variant="outline" className="h-auto py-4" onClick={handleExportDocument}>
                    <div className="flex flex-col items-center gap-2">
                      <FileJson className="h-8 w-8" />
                      <span>JSON</span>
                      <span className="text-xs text-muted-foreground">comments.json</span>
                    </div>
                  </Button>
                  <Button variant="outline" className="h-auto py-4" onClick={handleExportDocument}>
                    <div className="flex flex-col items-center gap-2">
                      <Download className="h-8 w-8" />
                      <span>Full Bundle</span>
                      <span className="text-xs text-muted-foreground">All artifacts</span>
                    </div>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

// Artifact List Item
interface ArtifactListItemProps {
  artifact: ResultArtifact;
  isSelected: boolean;
  onSelect: () => void;
  onToggleBookmark: () => void;
}

function ArtifactListItem({
  artifact,
  isSelected,
  onSelect,
  onToggleBookmark,
}: ArtifactListItemProps) {
  const typeIcons: Record<ResultArtifact['type'], React.ReactNode> = {
    figure: <Image className="h-4 w-4" />,
    table: <Table2 className="h-4 w-4" />,
    chart: <FileText className="h-4 w-4" />,
    summary: <FileText className="h-4 w-4" />,
    data: <FileText className="h-4 w-4" />,
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors',
        isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
      )}
      onClick={onSelect}
    >
      <div className={cn('p-1.5 rounded', isSelected ? 'bg-primary-foreground/20' : 'bg-muted')}>
        {typeIcons[artifact.type]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{artifact.name}</p>
        <div className="flex items-center gap-2 text-xs opacity-70">
          <span>Stage {artifact.sourceStage}</span>
          {artifact.commentCount > 0 && (
            <>
              <span>-</span>
              <span>{artifact.commentCount} comments</span>
            </>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={(e) => {
          e.stopPropagation();
          onToggleBookmark();
        }}
      >
        {artifact.isBookmarked ? (
          <BookmarkCheck className="h-4 w-4" />
        ) : (
          <Bookmark className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

// Artifact Viewer
interface ArtifactViewerProps {
  artifact: ResultArtifact;
  annotationTool: Annotation['type'] | null;
  selectedColor: string;
  onAddAnnotation: (annotation: Omit<Annotation, 'id' | 'createdAt' | 'createdBy'>) => void;
  onDeleteAnnotation: (annotationId: string) => void;
}

function ArtifactViewer({
  artifact,
  annotationTool,
  selectedColor,
  onAddAnnotation,
  onDeleteAnnotation,
}: ArtifactViewerProps) {
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!annotationTool || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      onAddAnnotation({
        artifactId: artifact.id,
        type: annotationTool,
        position: {
          x,
          y,
          width: annotationTool === 'box' ? 10 : undefined,
          height: annotationTool === 'box' ? 10 : undefined,
        },
        color: selectedColor,
        label: annotationTool === 'text' ? 'Note' : undefined,
      });
    },
    [annotationTool, selectedColor, artifact.id, onAddAnnotation]
  );

  return (
    <div className="space-y-4">
      {/* Zoom controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-sm w-16 text-center">{Math.round(zoom * 100)}%</span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      {/* Viewer */}
      <div
        ref={containerRef}
        className={cn(
          'relative border rounded-lg overflow-auto bg-muted/50 min-h-[400px]',
          annotationTool && 'cursor-crosshair'
        )}
        onClick={handleClick}
        style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
      >
        {artifact.type === 'figure' && artifact.imageUrl && (
          <img
            src={artifact.imageUrl}
            alt={artifact.name}
            className="max-w-full h-auto"
          />
        )}

        {artifact.type === 'table' && artifact.tableData && (
          <div className="p-4">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {Object.keys(artifact.tableData[0] || {}).map((key) => (
                    <th key={key} className="border p-2 bg-muted text-left">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {artifact.tableData.map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((value, j) => (
                      <td key={j} className="border p-2">
                        {String(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(artifact.type === 'summary' || artifact.type === 'data') && artifact.content && (
          <div className="p-4 prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap">{artifact.content}</pre>
          </div>
        )}

        {/* Render annotations */}
        {artifact.annotations.map((annotation) => (
          <AnnotationOverlay
            key={annotation.id}
            annotation={annotation}
            onDelete={() => onDeleteAnnotation(annotation.id)}
          />
        ))}
      </div>
    </div>
  );
}

// Annotation Overlay
interface AnnotationOverlayProps {
  annotation: Annotation;
  onDelete: () => void;
}

function AnnotationOverlay({ annotation, onDelete }: AnnotationOverlayProps) {
  const [showDelete, setShowDelete] = useState(false);

  return (
    <div
      className="absolute group"
      style={{
        left: `${annotation.position.x}%`,
        top: `${annotation.position.y}%`,
        width: annotation.position.width ? `${annotation.position.width}%` : 'auto',
        height: annotation.position.height ? `${annotation.position.height}%` : 'auto',
      }}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      {annotation.type === 'highlight' && (
        <div
          className="h-4 w-4 rounded-full opacity-50"
          style={{ backgroundColor: annotation.color }}
        />
      )}
      {annotation.type === 'box' && (
        <div
          className="w-full h-full border-2 rounded"
          style={{ borderColor: annotation.color }}
        />
      )}
      {annotation.type === 'text' && (
        <div
          className="px-2 py-1 rounded text-xs text-white"
          style={{ backgroundColor: annotation.color }}
        >
          {annotation.label}
        </div>
      )}
      {showDelete && (
        <Button
          variant="destructive"
          size="icon"
          className="absolute -top-2 -right-2 h-5 w-5"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

// Thread Card
interface ThreadCardProps {
  thread: CommentThread;
  currentUserId: string;
  showArtifactLink?: boolean;
  artifacts?: ResultArtifact[];
  onReply: (content: string) => void;
  onToggleResolved: () => void;
  onTogglePinned: () => void;
  onDelete: () => void;
}

function ThreadCard({
  thread,
  currentUserId,
  showArtifactLink,
  artifacts,
  onReply,
  onToggleResolved,
  onTogglePinned,
  onDelete,
}: ThreadCardProps) {
  const [isExpanded, setIsExpanded] = useState(thread.isExpanded);
  const artifact = showArtifactLink
    ? artifacts?.find((a) => a.id === thread.artifactId)
    : null;

  return (
    <Card className={cn(thread.rootComment.isResolved && 'opacity-60')}>
      <CardContent className="pt-4">
        <div className="flex gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={thread.rootComment.author.avatarUrl} />
            <AvatarFallback>
              {thread.rootComment.author.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  {thread.rootComment.author.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {thread.rootComment.createdAt.toLocaleDateString()}
                </span>
                {thread.rootComment.isPinned && (
                  <Badge variant="secondary" className="text-xs">
                    <Pin className="h-3 w-3 mr-1" />
                    Pinned
                  </Badge>
                )}
                {thread.rootComment.isResolved && (
                  <Badge variant="outline" className="text-xs text-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Resolved
                  </Badge>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onTogglePinned}>
                    {thread.rootComment.isPinned ? (
                      <>
                        <PinOff className="mr-2 h-4 w-4" />
                        Unpin
                      </>
                    ) : (
                      <>
                        <Pin className="mr-2 h-4 w-4" />
                        Pin
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onToggleResolved}>
                    {thread.rootComment.isResolved ? (
                      <>
                        <Circle className="mr-2 h-4 w-4" />
                        Reopen
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Resolve
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {showArtifactLink && artifact && (
              <Badge variant="outline" className="text-xs mt-1">
                {artifact.name}
              </Badge>
            )}

            <p className="text-sm mt-2">{thread.rootComment.content}</p>

            {/* Replies */}
            {thread.replies.length > 0 && (
              <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="mt-2 -ml-2">
                    {isExpanded ? (
                      <ChevronDown className="mr-1 h-4 w-4" />
                    ) : (
                      <ChevronRight className="mr-1 h-4 w-4" />
                    )}
                    {thread.replies.length} replies
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 pl-4 border-l-2 space-y-3">
                    {thread.replies.map((reply) => (
                      <div key={reply.id} className="flex gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={reply.author.avatarUrl} />
                          <AvatarFallback>
                            {reply.author.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-xs">
                              {reply.author.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {reply.createdAt.toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm">{reply.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="mt-2 -ml-2"
              onClick={() => onReply('')}
            >
              <Reply className="mr-1 h-4 w-4" />
              Reply
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Key Finding Card
interface KeyFindingCardProps {
  finding: KeyFinding;
  artifacts: ResultArtifact[];
  isEditing: boolean;
  editText: { title: string; description: string };
  onEditTextChange: (text: { title: string; description: string }) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (updates: Partial<KeyFinding>) => void;
  onDelete: () => void;
}

function KeyFindingCard({
  finding,
  artifacts,
  isEditing,
  editText,
  onEditTextChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
}: KeyFindingCardProps) {
  const significanceColors = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-blue-100 text-blue-700',
  };

  const confidenceColors = {
    high: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-orange-100 text-orange-700',
  };

  return (
    <Card>
      <CardContent className="pt-4">
        {isEditing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={editText.title}
                onChange={(e) =>
                  onEditTextChange({ ...editText, title: e.target.value })
                }
                placeholder="Enter finding title..."
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editText.description}
                onChange={(e) =>
                  onEditTextChange({ ...editText, description: e.target.value })
                }
                placeholder="Describe the finding in detail..."
                rows={4}
              />
            </div>
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
          <>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium">{finding.title || 'Untitled Finding'}</h4>
                  {finding.aiGenerated && (
                    <Badge variant="outline" className="text-xs">
                      <Sparkles className="h-3 w-3 mr-1" />
                      AI
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{finding.description}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onStartEdit}>
                  <Edit3 className="h-4 w-4" />
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

            <Separator className="my-3" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Select
                  value={finding.significance}
                  onValueChange={(v) =>
                    onUpdate({ significance: v as KeyFinding['significance'] })
                  }
                >
                  <SelectTrigger className="w-32 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High Significance</SelectItem>
                    <SelectItem value="medium">Medium Significance</SelectItem>
                    <SelectItem value="low">Low Significance</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={finding.confidence}
                  onValueChange={(v) =>
                    onUpdate({ confidence: v as KeyFinding['confidence'] })
                  }
                >
                  <SelectTrigger className="w-32 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High Confidence</SelectItem>
                    <SelectItem value="medium">Medium Confidence</SelectItem>
                    <SelectItem value="low">Low Confidence</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {finding.supportingArtifacts.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">
                    {finding.supportingArtifacts.length} supporting artifacts
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Suggestion Card
interface SuggestionCardProps {
  suggestion: InterpretationSuggestion;
  onAccept: () => void;
  onDismiss: () => void;
}

function SuggestionCard({ suggestion, onAccept, onDismiss }: SuggestionCardProps) {
  const typeConfig = {
    insight: { icon: Lightbulb, color: 'text-yellow-600' },
    question: { icon: AlertCircle, color: 'text-blue-600' },
    concern: { icon: Flag, color: 'text-red-600' },
    recommendation: { icon: CheckCircle, color: 'text-green-600' },
  };

  const config = typeConfig[suggestion.type];
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
      <Icon className={cn('h-5 w-5 mt-0.5', config.color)} />
      <div className="flex-1">
        <Badge variant="outline" className="text-xs mb-1">
          {suggestion.type}
        </Badge>
        <p className="text-sm">{suggestion.content}</p>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onAccept}>
          <Check className="h-4 w-4 text-green-600" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDismiss}>
          <X className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}

export default Stage09Interpretation;
