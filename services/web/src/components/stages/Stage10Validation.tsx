/**
 * Stage 10 - Validation
 * Review and validate research findings
 * Features: Validation checklist, reviewer assignment, progress tracking, issue flagging, sign-off workflow
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Users,
  ClipboardCheck,
  Flag,
  FileText,
  Download,
  RefreshCcw,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  MessageSquare,
  Shield,
  BarChart3,
  Beaker,
  Database,
  Repeat,
  Send,
  PenLine,
  Eye,
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

// ==================== Types ====================

export type ValidationCategory = 'methodology' | 'data_quality' | 'statistical_validity' | 'reproducibility';

export type ValidationItemStatus = 'pending' | 'in_progress' | 'passed' | 'failed' | 'not_applicable';

export type IssueSeverity = 'critical' | 'major' | 'minor' | 'suggestion';

export type IssueStatus = 'open' | 'in_review' | 'resolved' | 'wont_fix';

export type SignOffStatus = 'pending' | 'approved' | 'rejected' | 'requires_changes';

export interface Reviewer {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: 'primary' | 'secondary' | 'domain_expert';
  assignedCategories: ValidationCategory[];
  signOffStatus: SignOffStatus;
  signOffDate?: Date;
  comments?: string;
}

export interface ValidationItem {
  id: string;
  category: ValidationCategory;
  name: string;
  description: string;
  status: ValidationItemStatus;
  assignedReviewerId?: string;
  evidence?: string;
  notes?: string;
  completedAt?: Date;
  completedBy?: string;
}

export interface ValidationIssue {
  id: string;
  title: string;
  description: string;
  category: ValidationCategory;
  severity: IssueSeverity;
  status: IssueStatus;
  relatedItemIds: string[];
  reportedBy: string;
  reportedAt: Date;
  assignedTo?: string;
  resolvedAt?: Date;
  resolutionNotes?: string;
}

export interface ValidationChecklist {
  id: string;
  name: string;
  description: string;
  items: ValidationItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationReport {
  id: string;
  title: string;
  summary: string;
  generatedAt: Date;
  overallStatus: 'passed' | 'passed_with_warnings' | 'failed' | 'incomplete';
  categoryResults: Record<ValidationCategory, {
    passed: number;
    failed: number;
    pending: number;
    notApplicable: number;
  }>;
  criticalIssues: number;
  majorIssues: number;
  minorIssues: number;
  recommendations: string[];
}

interface Stage10Props {
  checklist: ValidationChecklist;
  reviewers: Reviewer[];
  issues: ValidationIssue[];
  report?: ValidationReport;
  currentUserId: string;
  onChecklistChange: (checklist: ValidationChecklist) => void;
  onReviewersChange: (reviewers: Reviewer[]) => void;
  onIssuesChange: (issues: ValidationIssue[]) => void;
  onGenerateReport?: () => Promise<ValidationReport>;
  onExportReport?: (format: 'json' | 'md' | 'pdf') => Promise<void>;
  onRequestSignOff?: (reviewerId: string) => Promise<void>;
  onSubmitSignOff?: (reviewerId: string, status: SignOffStatus, comments?: string) => Promise<void>;
  isProcessing?: boolean;
  className?: string;
}

// ==================== Category Configuration ====================

const CATEGORY_CONFIG: Record<ValidationCategory, {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = {
  methodology: {
    label: 'Methodology',
    description: 'Research design and methods validation',
    icon: Beaker,
    color: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  data_quality: {
    label: 'Data Quality',
    description: 'Data integrity and quality checks',
    icon: Database,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  statistical_validity: {
    label: 'Statistical Validity',
    description: 'Statistical analysis validation',
    icon: BarChart3,
    color: 'bg-green-100 text-green-700 border-green-200',
  },
  reproducibility: {
    label: 'Reproducibility',
    description: 'Reproducibility and replication checks',
    icon: Repeat,
    color: 'bg-orange-100 text-orange-700 border-orange-200',
  },
};

const SEVERITY_CONFIG: Record<IssueSeverity, {
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  major: { label: 'Major', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: AlertTriangle },
  minor: { label: 'Minor', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Flag },
  suggestion: { label: 'Suggestion', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: MessageSquare },
};

const STATUS_CONFIG: Record<ValidationItemStatus, {
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-700', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: RefreshCcw },
  passed: { label: 'Passed', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700', icon: XCircle },
  not_applicable: { label: 'N/A', color: 'bg-gray-100 text-gray-500', icon: X },
};

// ==================== Main Component ====================

export function Stage10Validation({
  checklist,
  reviewers,
  issues,
  report,
  currentUserId,
  onChecklistChange,
  onReviewersChange,
  onIssuesChange,
  onGenerateReport,
  onExportReport,
  onRequestSignOff,
  onSubmitSignOff,
  isProcessing = false,
  className,
}: Stage10Props) {
  const [selectedTab, setSelectedTab] = useState('checklist');
  const [expandedCategories, setExpandedCategories] = useState<Set<ValidationCategory>>(
    new Set(['methodology', 'data_quality', 'statistical_validity', 'reproducibility'])
  );
  const [isAddingIssue, setIsAddingIssue] = useState(false);
  const [isAddingReviewer, setIsAddingReviewer] = useState(false);
  const [signOffDialogOpen, setSignOffDialogOpen] = useState(false);
  const [selectedReviewerForSignOff, setSelectedReviewerForSignOff] = useState<Reviewer | null>(null);

  // Calculate progress statistics
  const progressStats = useMemo(() => {
    const items = checklist.items;
    const total = items.length;
    const passed = items.filter(i => i.status === 'passed').length;
    const failed = items.filter(i => i.status === 'failed').length;
    const pending = items.filter(i => i.status === 'pending').length;
    const inProgress = items.filter(i => i.status === 'in_progress').length;
    const notApplicable = items.filter(i => i.status === 'not_applicable').length;

    const completedCount = passed + failed + notApplicable;
    const progressPercent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    return { total, passed, failed, pending, inProgress, notApplicable, completedCount, progressPercent };
  }, [checklist.items]);

  // Group items by category
  const itemsByCategory = useMemo(() => {
    const grouped: Record<ValidationCategory, ValidationItem[]> = {
      methodology: [],
      data_quality: [],
      statistical_validity: [],
      reproducibility: [],
    };

    checklist.items.forEach(item => {
      grouped[item.category].push(item);
    });

    return grouped;
  }, [checklist.items]);

  // Calculate category progress
  const categoryProgress = useMemo(() => {
    const progress: Record<ValidationCategory, { completed: number; total: number; percent: number }> = {
      methodology: { completed: 0, total: 0, percent: 0 },
      data_quality: { completed: 0, total: 0, percent: 0 },
      statistical_validity: { completed: 0, total: 0, percent: 0 },
      reproducibility: { completed: 0, total: 0, percent: 0 },
    };

    (Object.keys(itemsByCategory) as ValidationCategory[]).forEach(category => {
      const items = itemsByCategory[category];
      const completed = items.filter(i =>
        i.status === 'passed' || i.status === 'failed' || i.status === 'not_applicable'
      ).length;
      progress[category] = {
        completed,
        total: items.length,
        percent: items.length > 0 ? Math.round((completed / items.length) * 100) : 0,
      };
    });

    return progress;
  }, [itemsByCategory]);

  // Issue statistics
  const issueStats = useMemo(() => {
    const open = issues.filter(i => i.status === 'open').length;
    const critical = issues.filter(i => i.severity === 'critical' && i.status !== 'resolved').length;
    const major = issues.filter(i => i.severity === 'major' && i.status !== 'resolved').length;
    const resolved = issues.filter(i => i.status === 'resolved').length;
    return { open, critical, major, resolved, total: issues.length };
  }, [issues]);

  // Sign-off status
  const signOffStatus = useMemo(() => {
    const pending = reviewers.filter(r => r.signOffStatus === 'pending').length;
    const approved = reviewers.filter(r => r.signOffStatus === 'approved').length;
    const rejected = reviewers.filter(r => r.signOffStatus === 'rejected').length;
    const requiresChanges = reviewers.filter(r => r.signOffStatus === 'requires_changes').length;
    const allApproved = reviewers.length > 0 && approved === reviewers.length;
    return { pending, approved, rejected, requiresChanges, allApproved };
  }, [reviewers]);

  // Toggle category expansion
  const toggleCategory = useCallback((category: ValidationCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // Update validation item
  const updateItem = useCallback((itemId: string, updates: Partial<ValidationItem>) => {
    const updatedItems = checklist.items.map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    );
    onChecklistChange({ ...checklist, items: updatedItems, updatedAt: new Date() });
  }, [checklist, onChecklistChange]);

  // Add new validation item
  const addItem = useCallback((category: ValidationCategory) => {
    const newItem: ValidationItem = {
      id: crypto.randomUUID(),
      category,
      name: 'New Validation Item',
      description: '',
      status: 'pending',
    };
    onChecklistChange({
      ...checklist,
      items: [...checklist.items, newItem],
      updatedAt: new Date(),
    });
  }, [checklist, onChecklistChange]);

  // Delete validation item
  const deleteItem = useCallback((itemId: string) => {
    const updatedItems = checklist.items.filter(item => item.id !== itemId);
    onChecklistChange({ ...checklist, items: updatedItems, updatedAt: new Date() });
  }, [checklist, onChecklistChange]);

  // Add new issue
  const addIssue = useCallback((issue: Omit<ValidationIssue, 'id' | 'reportedAt'>) => {
    const newIssue: ValidationIssue = {
      ...issue,
      id: crypto.randomUUID(),
      reportedAt: new Date(),
    };
    onIssuesChange([...issues, newIssue]);
    setIsAddingIssue(false);
  }, [issues, onIssuesChange]);

  // Update issue
  const updateIssue = useCallback((issueId: string, updates: Partial<ValidationIssue>) => {
    const updatedIssues = issues.map(issue =>
      issue.id === issueId ? { ...issue, ...updates } : issue
    );
    onIssuesChange(updatedIssues);
  }, [issues, onIssuesChange]);

  // Delete issue
  const deleteIssue = useCallback((issueId: string) => {
    onIssuesChange(issues.filter(i => i.id !== issueId));
  }, [issues, onIssuesChange]);

  // Add reviewer
  const addReviewer = useCallback((reviewer: Omit<Reviewer, 'id' | 'signOffStatus'>) => {
    const newReviewer: Reviewer = {
      ...reviewer,
      id: crypto.randomUUID(),
      signOffStatus: 'pending',
    };
    onReviewersChange([...reviewers, newReviewer]);
    setIsAddingReviewer(false);
  }, [reviewers, onReviewersChange]);

  // Update reviewer
  const updateReviewer = useCallback((reviewerId: string, updates: Partial<Reviewer>) => {
    const updatedReviewers = reviewers.map(reviewer =>
      reviewer.id === reviewerId ? { ...reviewer, ...updates } : reviewer
    );
    onReviewersChange(updatedReviewers);
  }, [reviewers, onReviewersChange]);

  // Remove reviewer
  const removeReviewer = useCallback((reviewerId: string) => {
    onReviewersChange(reviewers.filter(r => r.id !== reviewerId));
  }, [reviewers, onReviewersChange]);

  // Handle sign-off submission
  const handleSignOff = useCallback(async (status: SignOffStatus, comments?: string) => {
    if (!selectedReviewerForSignOff || !onSubmitSignOff) return;
    await onSubmitSignOff(selectedReviewerForSignOff.id, status, comments);
    setSignOffDialogOpen(false);
    setSelectedReviewerForSignOff(null);
  }, [selectedReviewerForSignOff, onSubmitSignOff]);

  // Check if validation can be completed
  const canCompleteValidation = useMemo(() => {
    return progressStats.progressPercent === 100 &&
           issueStats.critical === 0 &&
           signOffStatus.allApproved;
  }, [progressStats.progressPercent, issueStats.critical, signOffStatus.allApproved]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Critical Issues Alert */}
      {issueStats.critical > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Critical Issues Require Attention</AlertTitle>
          <AlertDescription>
            There are {issueStats.critical} critical issue(s) that must be resolved before validation can be completed.
          </AlertDescription>
        </Alert>
      )}

      {/* Overall Progress Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <ClipboardCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Validation Progress</CardTitle>
                <CardDescription>
                  {progressStats.completedCount} of {progressStats.total} items completed
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={canCompleteValidation ? 'default' : 'secondary'}>
                {canCompleteValidation ? 'Ready for Completion' : 'In Progress'}
              </Badge>
              {signOffStatus.allApproved && (
                <Badge className="bg-green-100 text-green-700">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  All Signed Off
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Overall Progress</span>
              <span className="font-mono font-medium">{progressStats.progressPercent}%</span>
            </div>
            <Progress value={progressStats.progressPercent} className="h-3" />
          </div>

          {/* Category Progress Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(Object.keys(CATEGORY_CONFIG) as ValidationCategory[]).map(category => {
              const config = CATEGORY_CONFIG[category];
              const progress = categoryProgress[category];
              const Icon = config.icon;

              return (
                <div
                  key={category}
                  className={cn('p-3 rounded-lg border', config.color)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-medium">{config.label}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold">{progress.percent}%</span>
                    <span className="text-xs">
                      {progress.completed}/{progress.total}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-5 gap-2">
            <QuickStat label="Passed" value={progressStats.passed} color="text-green-600" />
            <QuickStat label="Failed" value={progressStats.failed} color="text-red-600" />
            <QuickStat label="Pending" value={progressStats.pending} color="text-gray-600" />
            <QuickStat label="In Progress" value={progressStats.inProgress} color="text-blue-600" />
            <QuickStat label="N/A" value={progressStats.notApplicable} color="text-gray-400" />
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="checklist">
            <ClipboardCheck className="mr-2 h-4 w-4" />
            Checklist
          </TabsTrigger>
          <TabsTrigger value="reviewers">
            <Users className="mr-2 h-4 w-4" />
            Reviewers ({reviewers.length})
          </TabsTrigger>
          <TabsTrigger value="issues">
            <Flag className="mr-2 h-4 w-4" />
            Issues ({issueStats.open})
          </TabsTrigger>
          <TabsTrigger value="report">
            <FileText className="mr-2 h-4 w-4" />
            Report
          </TabsTrigger>
        </TabsList>

        {/* Checklist Tab */}
        <TabsContent value="checklist" className="mt-4">
          <ValidationChecklistPanel
            itemsByCategory={itemsByCategory}
            reviewers={reviewers}
            expandedCategories={expandedCategories}
            onToggleCategory={toggleCategory}
            onUpdateItem={updateItem}
            onAddItem={addItem}
            onDeleteItem={deleteItem}
          />
        </TabsContent>

        {/* Reviewers Tab */}
        <TabsContent value="reviewers" className="mt-4">
          <ReviewersPanel
            reviewers={reviewers}
            currentUserId={currentUserId}
            onAddReviewer={() => setIsAddingReviewer(true)}
            onUpdateReviewer={updateReviewer}
            onRemoveReviewer={removeReviewer}
            onRequestSignOff={onRequestSignOff}
            onOpenSignOffDialog={(reviewer) => {
              setSelectedReviewerForSignOff(reviewer);
              setSignOffDialogOpen(true);
            }}
          />
        </TabsContent>

        {/* Issues Tab */}
        <TabsContent value="issues" className="mt-4">
          <IssuesPanel
            issues={issues}
            issueStats={issueStats}
            reviewers={reviewers}
            onAddIssue={() => setIsAddingIssue(true)}
            onUpdateIssue={updateIssue}
            onDeleteIssue={deleteIssue}
          />
        </TabsContent>

        {/* Report Tab */}
        <TabsContent value="report" className="mt-4">
          <ReportPanel
            report={report}
            progressStats={progressStats}
            issueStats={issueStats}
            signOffStatus={signOffStatus}
            reviewers={reviewers}
            onGenerateReport={onGenerateReport}
            onExportReport={onExportReport}
            isProcessing={isProcessing}
          />
        </TabsContent>
      </Tabs>

      {/* Add Issue Dialog */}
      <AddIssueDialog
        open={isAddingIssue}
        onOpenChange={setIsAddingIssue}
        reviewers={reviewers}
        currentUserId={currentUserId}
        onAddIssue={addIssue}
      />

      {/* Add Reviewer Dialog */}
      <AddReviewerDialog
        open={isAddingReviewer}
        onOpenChange={setIsAddingReviewer}
        onAddReviewer={addReviewer}
      />

      {/* Sign-Off Dialog */}
      <SignOffDialog
        open={signOffDialogOpen}
        onOpenChange={setSignOffDialogOpen}
        reviewer={selectedReviewerForSignOff}
        progressStats={progressStats}
        issueStats={issueStats}
        onSubmit={handleSignOff}
      />
    </div>
  );
}

// ==================== Sub-Components ====================

// Quick Stat Display
function QuickStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center p-2 bg-muted/50 rounded-lg">
      <p className={cn('text-lg font-bold', color)}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// Validation Checklist Panel
function ValidationChecklistPanel({
  itemsByCategory,
  reviewers,
  expandedCategories,
  onToggleCategory,
  onUpdateItem,
  onAddItem,
  onDeleteItem,
}: {
  itemsByCategory: Record<ValidationCategory, ValidationItem[]>;
  reviewers: Reviewer[];
  expandedCategories: Set<ValidationCategory>;
  onToggleCategory: (category: ValidationCategory) => void;
  onUpdateItem: (itemId: string, updates: Partial<ValidationItem>) => void;
  onAddItem: (category: ValidationCategory) => void;
  onDeleteItem: (itemId: string) => void;
}) {
  return (
    <div className="space-y-4">
      {(Object.keys(CATEGORY_CONFIG) as ValidationCategory[]).map(category => {
        const config = CATEGORY_CONFIG[category];
        const items = itemsByCategory[category];
        const isExpanded = expandedCategories.has(category);
        const Icon = config.icon;

        const completedCount = items.filter(i =>
          i.status === 'passed' || i.status === 'failed' || i.status === 'not_applicable'
        ).length;

        return (
          <Collapsible
            key={category}
            open={isExpanded}
            onOpenChange={() => onToggleCategory(category)}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn('p-2 rounded-lg', config.color)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{config.label}</CardTitle>
                        <CardDescription>{config.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">
                        {completedCount}/{items.length} completed
                      </Badge>
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <ScrollArea className="max-h-[400px]">
                    <div className="space-y-2">
                      {items.map(item => (
                        <ValidationItemCard
                          key={item.id}
                          item={item}
                          reviewers={reviewers}
                          onUpdate={(updates) => onUpdateItem(item.id, updates)}
                          onDelete={() => onDeleteItem(item.id)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => onAddItem(category)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}

// Validation Item Card
function ValidationItemCard({
  item,
  reviewers,
  onUpdate,
  onDelete,
}: {
  item: ValidationItem;
  reviewers: Reviewer[];
  onUpdate: (updates: Partial<ValidationItem>) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editDescription, setEditDescription] = useState(item.description);
  const [showNotes, setShowNotes] = useState(false);

  const statusConfig = STATUS_CONFIG[item.status];
  const StatusIcon = statusConfig.icon;

  const handleSave = () => {
    onUpdate({ name: editName, description: editDescription });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(item.name);
    setEditDescription(item.description);
    setIsEditing(false);
  };

  return (
    <Card className={cn(
      'transition-colors',
      item.status === 'passed' && 'border-green-200 bg-green-50/30',
      item.status === 'failed' && 'border-red-200 bg-red-50/30'
    )}>
      <CardContent className="py-3">
        {isEditing ? (
          <div className="space-y-3">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Item name"
            />
            <Textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description"
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X className="mr-1 h-4 w-4" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Check className="mr-1 h-4 w-4" />
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div className={cn('p-1.5 rounded-full mt-0.5', statusConfig.color)}>
                <StatusIcon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{item.name}</p>
                {item.description && (
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsEditing(true)}
                >
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

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Select
                  value={item.status}
                  onValueChange={(v) => onUpdate({
                    status: v as ValidationItemStatus,
                    completedAt: ['passed', 'failed', 'not_applicable'].includes(v) ? new Date() : undefined,
                  })}
                >
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="passed">Passed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="not_applicable">N/A</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={item.assignedReviewerId || ''}
                  onValueChange={(v) => onUpdate({ assignedReviewerId: v || undefined })}
                >
                  <SelectTrigger className="h-8 w-40">
                    <SelectValue placeholder="Assign to..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {reviewers.map(reviewer => (
                      <SelectItem key={reviewer.id} value={reviewer.id}>
                        {reviewer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNotes(!showNotes)}
              >
                <MessageSquare className="mr-1 h-4 w-4" />
                Notes
              </Button>
            </div>

            {showNotes && (
              <div className="pt-2 space-y-2">
                <Label className="text-xs">Evidence/Notes</Label>
                <Textarea
                  value={item.notes || ''}
                  onChange={(e) => onUpdate({ notes: e.target.value })}
                  placeholder="Add evidence or notes..."
                  rows={2}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Reviewers Panel
function ReviewersPanel({
  reviewers,
  currentUserId,
  onAddReviewer,
  onUpdateReviewer,
  onRemoveReviewer,
  onRequestSignOff,
  onOpenSignOffDialog,
}: {
  reviewers: Reviewer[];
  currentUserId: string;
  onAddReviewer: () => void;
  onUpdateReviewer: (reviewerId: string, updates: Partial<Reviewer>) => void;
  onRemoveReviewer: (reviewerId: string) => void;
  onRequestSignOff?: (reviewerId: string) => Promise<void>;
  onOpenSignOffDialog: (reviewer: Reviewer) => void;
}) {
  const signOffStatusColors: Record<SignOffStatus, string> = {
    pending: 'bg-gray-100 text-gray-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    requires_changes: 'bg-yellow-100 text-yellow-700',
  };

  const roleLabels: Record<Reviewer['role'], string> = {
    primary: 'Primary Reviewer',
    secondary: 'Secondary Reviewer',
    domain_expert: 'Domain Expert',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Assigned Reviewers</h3>
          <p className="text-sm text-muted-foreground">
            Manage reviewers and track sign-off status
          </p>
        </div>
        <Button onClick={onAddReviewer}>
          <Plus className="mr-2 h-4 w-4" />
          Add Reviewer
        </Button>
      </div>

      <div className="grid gap-4">
        {reviewers.map(reviewer => (
          <Card key={reviewer.id}>
            <CardContent className="py-4">
              <div className="flex items-start gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={reviewer.avatarUrl} />
                  <AvatarFallback>
                    {reviewer.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{reviewer.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {roleLabels[reviewer.role]}
                    </Badge>
                    <Badge className={cn('text-xs', signOffStatusColors[reviewer.signOffStatus])}>
                      {reviewer.signOffStatus.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{reviewer.email}</p>

                  <div className="flex flex-wrap gap-1 mt-2">
                    {reviewer.assignedCategories.map(category => (
                      <Badge
                        key={category}
                        variant="secondary"
                        className={cn('text-xs', CATEGORY_CONFIG[category].color)}
                      >
                        {CATEGORY_CONFIG[category].label}
                      </Badge>
                    ))}
                  </div>

                  {reviewer.signOffDate && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Signed off: {reviewer.signOffDate.toLocaleDateString()}
                    </p>
                  )}

                  {reviewer.comments && (
                    <p className="text-sm mt-2 p-2 bg-muted rounded">
                      "{reviewer.comments}"
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {reviewer.signOffStatus === 'pending' && onRequestSignOff && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRequestSignOff(reviewer.id)}
                    >
                      <Send className="mr-1 h-4 w-4" />
                      Request
                    </Button>
                  )}
                  {reviewer.id === currentUserId && reviewer.signOffStatus === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => onOpenSignOffDialog(reviewer)}
                    >
                      <PenLine className="mr-1 h-4 w-4" />
                      Sign Off
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => onRemoveReviewer(reviewer.id)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {reviewers.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                No reviewers assigned yet
              </p>
              <Button variant="outline" className="mt-4" onClick={onAddReviewer}>
                <Plus className="mr-2 h-4 w-4" />
                Add First Reviewer
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Issues Panel
function IssuesPanel({
  issues,
  issueStats,
  reviewers,
  onAddIssue,
  onUpdateIssue,
  onDeleteIssue,
}: {
  issues: ValidationIssue[];
  issueStats: { open: number; critical: number; major: number; resolved: number; total: number };
  reviewers: Reviewer[];
  onAddIssue: () => void;
  onUpdateIssue: (issueId: string, updates: Partial<ValidationIssue>) => void;
  onDeleteIssue: (issueId: string) => void;
}) {
  const [filterSeverity, setFilterSeverity] = useState<IssueSeverity | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<IssueStatus | 'all'>('all');

  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      if (filterSeverity !== 'all' && issue.severity !== filterSeverity) return false;
      if (filterStatus !== 'all' && issue.status !== filterStatus) return false;
      return true;
    });
  }, [issues, filterSeverity, filterStatus]);

  const issueStatusColors: Record<IssueStatus, string> = {
    open: 'bg-red-100 text-red-700',
    in_review: 'bg-blue-100 text-blue-700',
    resolved: 'bg-green-100 text-green-700',
    wont_fix: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="space-y-4">
      {/* Issue Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Issue Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{issueStats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{issueStats.critical}</p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">{issueStats.major}</p>
              <p className="text-xs text-muted-foreground">Major</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">{issueStats.open}</p>
              <p className="text-xs text-muted-foreground">Open</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{issueStats.resolved}</p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters and Add Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select
            value={filterSeverity}
            onValueChange={(v) => setFilterSeverity(v as IssueSeverity | 'all')}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="major">Major</SelectItem>
              <SelectItem value="minor">Minor</SelectItem>
              <SelectItem value="suggestion">Suggestion</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filterStatus}
            onValueChange={(v) => setFilterStatus(v as IssueStatus | 'all')}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_review">In Review</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="wont_fix">Won't Fix</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={onAddIssue}>
          <Plus className="mr-2 h-4 w-4" />
          Flag Issue
        </Button>
      </div>

      {/* Issues List */}
      <ScrollArea className="h-[500px]">
        <div className="space-y-3">
          {filteredIssues.map(issue => {
            const severityConfig = SEVERITY_CONFIG[issue.severity];
            const SeverityIcon = severityConfig.icon;
            const categoryConfig = CATEGORY_CONFIG[issue.category];

            return (
              <Card key={issue.id} className={cn(
                issue.severity === 'critical' && issue.status !== 'resolved' && 'border-red-300',
                issue.status === 'resolved' && 'opacity-75'
              )}>
                <CardContent className="py-3">
                  <div className="flex items-start gap-3">
                    <div className={cn('p-1.5 rounded-full', severityConfig.color)}>
                      <SeverityIcon className="h-4 w-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{issue.title}</span>
                        <Badge className={cn('text-xs', severityConfig.color)}>
                          {severityConfig.label}
                        </Badge>
                        <Badge className={cn('text-xs', issueStatusColors[issue.status])}>
                          {issue.status.replace('_', ' ')}
                        </Badge>
                        <Badge variant="outline" className={cn('text-xs', categoryConfig.color)}>
                          {categoryConfig.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{issue.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Reported by {issue.reportedBy} on {issue.reportedAt.toLocaleDateString()}
                      </p>

                      {issue.resolutionNotes && (
                        <div className="mt-2 p-2 bg-green-50 rounded text-sm">
                          <span className="font-medium">Resolution:</span> {issue.resolutionNotes}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <Select
                        value={issue.status}
                        onValueChange={(v) => onUpdateIssue(issue.id, {
                          status: v as IssueStatus,
                          resolvedAt: v === 'resolved' ? new Date() : undefined,
                        })}
                      >
                        <SelectTrigger className="h-8 w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_review">In Review</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="wont_fix">Won't Fix</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => onDeleteIssue(issue.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filteredIssues.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                <p className="text-muted-foreground text-center">
                  {issues.length === 0
                    ? 'No issues flagged yet'
                    : 'No issues match the current filters'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Report Panel
function ReportPanel({
  report,
  progressStats,
  issueStats,
  signOffStatus,
  reviewers,
  onGenerateReport,
  onExportReport,
  isProcessing,
}: {
  report?: ValidationReport;
  progressStats: { total: number; passed: number; failed: number; pending: number; completedCount: number; progressPercent: number };
  issueStats: { open: number; critical: number; major: number; resolved: number; total: number };
  signOffStatus: { pending: number; approved: number; rejected: number; requiresChanges: number; allApproved: boolean };
  reviewers: Reviewer[];
  onGenerateReport?: () => Promise<ValidationReport>;
  onExportReport?: (format: 'json' | 'md' | 'pdf') => Promise<void>;
  isProcessing: boolean;
}) {
  const overallStatusColors: Record<string, string> = {
    passed: 'bg-green-100 text-green-700',
    passed_with_warnings: 'bg-yellow-100 text-yellow-700',
    failed: 'bg-red-100 text-red-700',
    incomplete: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="space-y-4">
      {/* Generate Report Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Validation Report
              </CardTitle>
              <CardDescription>
                Generate and export the validation report
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={onGenerateReport}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Generate Report
                  </>
                )}
              </Button>
              {report && (
                <Select onValueChange={(v) => onExportReport?.(v as 'json' | 'md' | 'pdf')}>
                  <SelectTrigger className="w-32">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="md">Markdown</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Report Content */}
      {report ? (
        <div className="space-y-4">
          {/* Report Header */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold">{report.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    Generated: {report.generatedAt.toLocaleString()}
                  </p>
                </div>
                <Badge className={cn('text-lg px-4 py-1', overallStatusColors[report.overallStatus])}>
                  {report.overallStatus.replace(/_/g, ' ').toUpperCase()}
                </Badge>
              </div>
              <p className="text-muted-foreground">{report.summary}</p>
            </CardContent>
          </Card>

          {/* Category Results */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Category Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(Object.keys(CATEGORY_CONFIG) as ValidationCategory[]).map(category => {
                  const config = CATEGORY_CONFIG[category];
                  const results = report.categoryResults[category];
                  const Icon = config.icon;

                  return (
                    <Card key={category} className={cn('border', config.color)}>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Icon className="h-4 w-4" />
                          <span className="text-sm font-medium">{config.label}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-center text-xs">
                          <div>
                            <p className="font-bold text-green-600">{results.passed}</p>
                            <p className="text-muted-foreground">Passed</p>
                          </div>
                          <div>
                            <p className="font-bold text-red-600">{results.failed}</p>
                            <p className="text-muted-foreground">Failed</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {report.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Sign-Off Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sign-Off Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {reviewers.map(reviewer => (
                  <div
                    key={reviewer.id}
                    className="flex items-center justify-between p-2 rounded border"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {reviewer.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{reviewer.name}</span>
                    </div>
                    <Badge className={cn(
                      'text-xs',
                      reviewer.signOffStatus === 'approved' && 'bg-green-100 text-green-700',
                      reviewer.signOffStatus === 'pending' && 'bg-gray-100 text-gray-700',
                      reviewer.signOffStatus === 'rejected' && 'bg-red-100 text-red-700',
                      reviewer.signOffStatus === 'requires_changes' && 'bg-yellow-100 text-yellow-700'
                    )}>
                      {reviewer.signOffStatus === 'approved' && <CheckCircle className="mr-1 h-3 w-3" />}
                      {reviewer.signOffStatus.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No report generated yet
            </p>
            <p className="text-sm text-muted-foreground text-center">
              Complete the validation checklist and generate a report
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ==================== Dialogs ====================

// Add Issue Dialog
function AddIssueDialog({
  open,
  onOpenChange,
  reviewers,
  currentUserId,
  onAddIssue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviewers: Reviewer[];
  currentUserId: string;
  onAddIssue: (issue: Omit<ValidationIssue, 'id' | 'reportedAt'>) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ValidationCategory>('methodology');
  const [severity, setSeverity] = useState<IssueSeverity>('minor');
  const [assignedTo, setAssignedTo] = useState('');

  const handleSubmit = () => {
    onAddIssue({
      title,
      description,
      category,
      severity,
      status: 'open',
      relatedItemIds: [],
      reportedBy: currentUserId,
      assignedTo: assignedTo || undefined,
    });
    // Reset form
    setTitle('');
    setDescription('');
    setCategory('methodology');
    setSeverity('minor');
    setAssignedTo('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Flag an Issue</DialogTitle>
          <DialogDescription>
            Report a validation issue that needs to be addressed
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief description of the issue"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description of the issue..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as ValidationCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORY_CONFIG) as ValidationCategory[]).map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {CATEGORY_CONFIG[cat].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Severity</Label>
              <Select
                value={severity}
                onValueChange={(v) => setSeverity(v as IssueSeverity)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="major">Major</SelectItem>
                  <SelectItem value="minor">Minor</SelectItem>
                  <SelectItem value="suggestion">Suggestion</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assign to (optional)</Label>
            <Select
              value={assignedTo}
              onValueChange={setAssignedTo}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select reviewer..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassigned</SelectItem>
                {reviewers.map(reviewer => (
                  <SelectItem key={reviewer.id} value={reviewer.id}>
                    {reviewer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim()}>
            <Flag className="mr-2 h-4 w-4" />
            Flag Issue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Add Reviewer Dialog
function AddReviewerDialog({
  open,
  onOpenChange,
  onAddReviewer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddReviewer: (reviewer: Omit<Reviewer, 'id' | 'signOffStatus'>) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Reviewer['role']>('secondary');
  const [assignedCategories, setAssignedCategories] = useState<ValidationCategory[]>([]);

  const toggleCategory = (category: ValidationCategory) => {
    setAssignedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleSubmit = () => {
    onAddReviewer({
      name,
      email,
      role,
      assignedCategories,
    });
    // Reset form
    setName('');
    setEmail('');
    setRole('secondary');
    setAssignedCategories([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Reviewer</DialogTitle>
          <DialogDescription>
            Assign a reviewer to validate research findings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Reviewer name"
            />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="reviewer@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as Reviewer['role'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primary">Primary Reviewer</SelectItem>
                <SelectItem value="secondary">Secondary Reviewer</SelectItem>
                <SelectItem value="domain_expert">Domain Expert</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Assigned Categories</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(CATEGORY_CONFIG) as ValidationCategory[]).map(category => (
                <div
                  key={category}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors',
                    assignedCategories.includes(category)
                      ? CATEGORY_CONFIG[category].color
                      : 'hover:bg-muted'
                  )}
                  onClick={() => toggleCategory(category)}
                >
                  <Checkbox checked={assignedCategories.includes(category)} />
                  <span className="text-sm">{CATEGORY_CONFIG[category].label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || !email.trim()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Reviewer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Sign-Off Dialog
function SignOffDialog({
  open,
  onOpenChange,
  reviewer,
  progressStats,
  issueStats,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviewer: Reviewer | null;
  progressStats: { total: number; passed: number; failed: number; progressPercent: number };
  issueStats: { critical: number; major: number; open: number };
  onSubmit: (status: SignOffStatus, comments?: string) => void;
}) {
  const [comments, setComments] = useState('');

  if (!reviewer) return null;

  const hasBlockingIssues = issueStats.critical > 0;
  const isIncomplete = progressStats.progressPercent < 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sign-Off Validation</DialogTitle>
          <DialogDescription>
            Review the validation status and provide your sign-off
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-xl font-bold">{progressStats.progressPercent}%</p>
              <p className="text-xs text-muted-foreground">Complete</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-xl font-bold text-green-600">{progressStats.passed}</p>
              <p className="text-xs text-muted-foreground">Passed</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-xl font-bold text-red-600">{progressStats.failed}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </div>

          {/* Warnings */}
          {hasBlockingIssues && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Critical Issues Pending</AlertTitle>
              <AlertDescription>
                There are {issueStats.critical} critical issue(s) that should be addressed.
              </AlertDescription>
            </Alert>
          )}

          {isIncomplete && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertTitle>Validation Incomplete</AlertTitle>
              <AlertDescription>
                The validation checklist is {100 - progressStats.progressPercent}% incomplete.
              </AlertDescription>
            </Alert>
          )}

          {/* Comments */}
          <div className="space-y-2">
            <Label>Comments (optional)</Label>
            <Textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Add any comments or notes about your sign-off..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onSubmit('requires_changes', comments)}
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Requires Changes
          </Button>
          <Button
            variant="destructive"
            onClick={() => onSubmit('rejected', comments)}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Reject
          </Button>
          <Button
            onClick={() => onSubmit('approved', comments)}
            disabled={hasBlockingIssues}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default Stage10Validation;
