/**
 * Stage 13 - Internal Review
 * Simulate peer review feedback
 * Features: AI reviewer persona configuration, review rubric customization,
 * simulated review feedback display with severity, response drafting,
 * review scorecard with ratings, multiple review rounds tracking,
 * export review feedback and scorecard
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  Users,
  Bot,
  MessageSquare,
  Star,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Clock,
  RefreshCcw,
  Download,
  Send,
  FileText,
  Settings,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  BarChart3,
  Target,
  Beaker,
  Calculator,
  BookOpen,
  Lightbulb,
  ArrowRight,
  History,
  Copy,
  Eye,
  PenLine,
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
import { Slider } from '@/components/ui/slider';
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
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

// ==================== Types ====================

export type ReviewerPersonaType = 'methodology_expert' | 'statistician' | 'domain_expert' | 'general_reviewer';

export type FeedbackSeverity = 'critical' | 'major' | 'minor' | 'suggestion' | 'positive';

export type FeedbackCategory = 'methodology' | 'statistics' | 'presentation' | 'novelty' | 'reproducibility' | 'ethics' | 'general';

export type FeedbackStatus = 'pending' | 'addressed' | 'disputed' | 'acknowledged';

export type ReviewRoundStatus = 'draft' | 'in_progress' | 'completed';

export type RatingLevel = 1 | 2 | 3 | 4 | 5;

export interface ReviewerPersona {
  id: string;
  type: ReviewerPersonaType;
  name: string;
  description: string;
  avatarUrl?: string;
  expertise: string[];
  strictness: number; // 1-5, affects how critical feedback is
  focusAreas: FeedbackCategory[];
  isEnabled: boolean;
}

export interface RubricCriterion {
  id: string;
  category: FeedbackCategory;
  name: string;
  description: string;
  weight: number; // 0-100, contribution to overall score
  maxScore: number;
  isRequired: boolean;
}

export interface ReviewRubric {
  id: string;
  name: string;
  description: string;
  criteria: RubricCriterion[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewFeedbackItem {
  id: string;
  reviewerPersonaId: string;
  roundNumber: number;
  category: FeedbackCategory;
  severity: FeedbackSeverity;
  status: FeedbackStatus;
  title: string;
  content: string;
  lineReference?: string; // e.g., "Section 2.3, paragraph 4"
  suggestion?: string;
  authorResponse?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CriterionScore {
  criterionId: string;
  score: number;
  maxScore: number;
  comment?: string;
}

export interface ReviewScorecard {
  id: string;
  roundNumber: number;
  reviewerPersonaId: string;
  criterionScores: CriterionScore[];
  overallScore: number;
  overallRating: RatingLevel;
  recommendation: 'accept' | 'minor_revision' | 'major_revision' | 'reject';
  strengthsSummary: string;
  weaknessesSummary: string;
  generalComments?: string;
  createdAt: Date;
}

export interface ReviewRound {
  id: string;
  roundNumber: number;
  status: ReviewRoundStatus;
  activePersonaIds: string[];
  feedbackItems: ReviewFeedbackItem[];
  scorecards: ReviewScorecard[];
  startedAt?: Date;
  completedAt?: Date;
  notes?: string;
}

interface Stage13Props {
  personas: ReviewerPersona[];
  rubric: ReviewRubric;
  rounds: ReviewRound[];
  currentRoundNumber: number;
  onPersonasChange: (personas: ReviewerPersona[]) => void;
  onRubricChange: (rubric: ReviewRubric) => void;
  onRoundsChange: (rounds: ReviewRound[]) => void;
  onStartReview?: (roundNumber: number, personaIds: string[]) => Promise<void>;
  onGenerateFeedback?: (roundNumber: number, personaId: string) => Promise<ReviewFeedbackItem[]>;
  onGenerateScorecard?: (roundNumber: number, personaId: string) => Promise<ReviewScorecard>;
  onExportFeedback?: (format: 'json' | 'md' | 'pdf') => Promise<void>;
  onExportScorecard?: (format: 'json' | 'md' | 'pdf') => Promise<void>;
  isProcessing?: boolean;
  className?: string;
}

// ==================== Configuration ====================

const PERSONA_CONFIG: Record<ReviewerPersonaType, {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  defaultExpertise: string[];
  defaultFocusAreas: FeedbackCategory[];
}> = {
  methodology_expert: {
    label: 'Methodology Expert',
    description: 'Focuses on research design, experimental validity, and methodological rigor',
    icon: Beaker,
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    defaultExpertise: ['Research Design', 'Experimental Methods', 'Validity Assessment'],
    defaultFocusAreas: ['methodology', 'reproducibility'],
  },
  statistician: {
    label: 'Statistician',
    description: 'Evaluates statistical methods, data analysis, and interpretation accuracy',
    icon: Calculator,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    defaultExpertise: ['Statistical Analysis', 'Data Modeling', 'Hypothesis Testing'],
    defaultFocusAreas: ['statistics', 'methodology'],
  },
  domain_expert: {
    label: 'Domain Expert',
    description: 'Reviews domain-specific content, novelty, and scientific contribution',
    icon: BookOpen,
    color: 'bg-green-100 text-green-700 border-green-200',
    defaultExpertise: ['Subject Matter Expertise', 'Literature Context', 'Scientific Impact'],
    defaultFocusAreas: ['novelty', 'general', 'presentation'],
  },
  general_reviewer: {
    label: 'General Reviewer',
    description: 'Provides broad feedback on clarity, presentation, and overall quality',
    icon: Users,
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    defaultExpertise: ['Scientific Writing', 'Clarity Assessment', 'Logical Flow'],
    defaultFocusAreas: ['presentation', 'general'],
  },
};

const SEVERITY_CONFIG: Record<FeedbackSeverity, {
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  priority: number;
}> = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle, priority: 1 },
  major: { label: 'Major', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: AlertTriangle, priority: 2 },
  minor: { label: 'Minor', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: MessageSquare, priority: 3 },
  suggestion: { label: 'Suggestion', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Lightbulb, priority: 4 },
  positive: { label: 'Positive', color: 'bg-green-100 text-green-700 border-green-200', icon: ThumbsUp, priority: 5 },
};

const CATEGORY_CONFIG: Record<FeedbackCategory, {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  methodology: { label: 'Methodology', description: 'Research design and methods', icon: Beaker },
  statistics: { label: 'Statistics', description: 'Statistical analysis and interpretation', icon: BarChart3 },
  presentation: { label: 'Presentation', description: 'Writing clarity and organization', icon: FileText },
  novelty: { label: 'Novelty', description: 'Scientific contribution and originality', icon: Sparkles },
  reproducibility: { label: 'Reproducibility', description: 'Ability to replicate findings', icon: RefreshCcw },
  ethics: { label: 'Ethics', description: 'Ethical considerations and compliance', icon: Target },
  general: { label: 'General', description: 'Overall comments and feedback', icon: MessageSquare },
};

const STATUS_CONFIG: Record<FeedbackStatus, {
  label: string;
  color: string;
}> = {
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-700' },
  addressed: { label: 'Addressed', color: 'bg-green-100 text-green-700' },
  disputed: { label: 'Disputed', color: 'bg-orange-100 text-orange-700' },
  acknowledged: { label: 'Acknowledged', color: 'bg-blue-100 text-blue-700' },
};

const RECOMMENDATION_CONFIG: Record<string, {
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  accept: { label: 'Accept', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  minor_revision: { label: 'Minor Revision', color: 'bg-blue-100 text-blue-700', icon: PenLine },
  major_revision: { label: 'Major Revision', color: 'bg-orange-100 text-orange-700', icon: RefreshCcw },
  reject: { label: 'Reject', color: 'bg-red-100 text-red-700', icon: XCircle },
};

// ==================== Main Component ====================

export function Stage13InternalReview({
  personas,
  rubric,
  rounds,
  currentRoundNumber,
  onPersonasChange,
  onRubricChange,
  onRoundsChange,
  onStartReview,
  onGenerateFeedback,
  onGenerateScorecard,
  onExportFeedback,
  onExportScorecard,
  isProcessing = false,
  className,
}: Stage13Props) {
  const [selectedTab, setSelectedTab] = useState('feedback');
  const [selectedRound, setSelectedRound] = useState<number>(currentRoundNumber);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isRubricDialogOpen, setIsRubricDialogOpen] = useState(false);
  const [isResponseDialogOpen, setIsResponseDialogOpen] = useState(false);
  const [selectedFeedbackItem, setSelectedFeedbackItem] = useState<ReviewFeedbackItem | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<FeedbackCategory>>(
    new Set(['methodology', 'statistics', 'presentation', 'novelty', 'reproducibility', 'ethics', 'general'])
  );

  // Get current round data
  const currentRound = useMemo(() => {
    return rounds.find(r => r.roundNumber === selectedRound);
  }, [rounds, selectedRound]);

  // Calculate feedback statistics
  const feedbackStats = useMemo(() => {
    if (!currentRound) return { total: 0, critical: 0, major: 0, minor: 0, suggestion: 0, positive: 0, addressed: 0 };
    const items = currentRound.feedbackItems;
    return {
      total: items.length,
      critical: items.filter(i => i.severity === 'critical').length,
      major: items.filter(i => i.severity === 'major').length,
      minor: items.filter(i => i.severity === 'minor').length,
      suggestion: items.filter(i => i.severity === 'suggestion').length,
      positive: items.filter(i => i.severity === 'positive').length,
      addressed: items.filter(i => i.status === 'addressed').length,
    };
  }, [currentRound]);

  // Calculate overall scores
  const overallScores = useMemo(() => {
    if (!currentRound || currentRound.scorecards.length === 0) return null;
    const scores = currentRound.scorecards.map(s => s.overallScore);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const recommendations = currentRound.scorecards.map(s => s.recommendation);
    return {
      averageScore: avgScore,
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
      recommendations,
    };
  }, [currentRound]);

  // Group feedback by category
  const feedbackByCategory = useMemo(() => {
    if (!currentRound) return {};
    const grouped: Partial<Record<FeedbackCategory, ReviewFeedbackItem[]>> = {};
    currentRound.feedbackItems.forEach(item => {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category]!.push(item);
    });
    // Sort by severity priority within each category
    Object.keys(grouped).forEach(cat => {
      grouped[cat as FeedbackCategory]!.sort((a, b) =>
        SEVERITY_CONFIG[a.severity].priority - SEVERITY_CONFIG[b.severity].priority
      );
    });
    return grouped;
  }, [currentRound]);

  // Get enabled personas
  const enabledPersonas = useMemo(() => {
    return personas.filter(p => p.isEnabled);
  }, [personas]);

  // Toggle category expansion
  const toggleCategory = useCallback((category: FeedbackCategory) => {
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

  // Update persona
  const updatePersona = useCallback((personaId: string, updates: Partial<ReviewerPersona>) => {
    const updatedPersonas = personas.map(p =>
      p.id === personaId ? { ...p, ...updates } : p
    );
    onPersonasChange(updatedPersonas);
  }, [personas, onPersonasChange]);

  // Add new persona
  const addPersona = useCallback((type: ReviewerPersonaType) => {
    const config = PERSONA_CONFIG[type];
    const newPersona: ReviewerPersona = {
      id: crypto.randomUUID(),
      type,
      name: config.label,
      description: config.description,
      expertise: [...config.defaultExpertise],
      strictness: 3,
      focusAreas: [...config.defaultFocusAreas],
      isEnabled: true,
    };
    onPersonasChange([...personas, newPersona]);
  }, [personas, onPersonasChange]);

  // Remove persona
  const removePersona = useCallback((personaId: string) => {
    onPersonasChange(personas.filter(p => p.id !== personaId));
  }, [personas, onPersonasChange]);

  // Update rubric criterion
  const updateCriterion = useCallback((criterionId: string, updates: Partial<RubricCriterion>) => {
    const updatedCriteria = rubric.criteria.map(c =>
      c.id === criterionId ? { ...c, ...updates } : c
    );
    onRubricChange({ ...rubric, criteria: updatedCriteria, updatedAt: new Date() });
  }, [rubric, onRubricChange]);

  // Add rubric criterion
  const addCriterion = useCallback(() => {
    const newCriterion: RubricCriterion = {
      id: crypto.randomUUID(),
      category: 'general',
      name: 'New Criterion',
      description: '',
      weight: 10,
      maxScore: 10,
      isRequired: false,
    };
    onRubricChange({
      ...rubric,
      criteria: [...rubric.criteria, newCriterion],
      updatedAt: new Date(),
    });
  }, [rubric, onRubricChange]);

  // Remove rubric criterion
  const removeCriterion = useCallback((criterionId: string) => {
    onRubricChange({
      ...rubric,
      criteria: rubric.criteria.filter(c => c.id !== criterionId),
      updatedAt: new Date(),
    });
  }, [rubric, onRubricChange]);

  // Update feedback item status and response
  const updateFeedbackItem = useCallback((itemId: string, updates: Partial<ReviewFeedbackItem>) => {
    if (!currentRound) return;
    const updatedItems = currentRound.feedbackItems.map(item =>
      item.id === itemId ? { ...item, ...updates, updatedAt: new Date() } : item
    );
    const updatedRounds = rounds.map(r =>
      r.roundNumber === selectedRound ? { ...r, feedbackItems: updatedItems } : r
    );
    onRoundsChange(updatedRounds);
  }, [currentRound, rounds, selectedRound, onRoundsChange]);

  // Start a new review round
  const startNewRound = useCallback(async () => {
    const newRoundNumber = rounds.length + 1;
    const newRound: ReviewRound = {
      id: crypto.randomUUID(),
      roundNumber: newRoundNumber,
      status: 'in_progress',
      activePersonaIds: enabledPersonas.map(p => p.id),
      feedbackItems: [],
      scorecards: [],
      startedAt: new Date(),
    };
    onRoundsChange([...rounds, newRound]);
    setSelectedRound(newRoundNumber);
    if (onStartReview) {
      await onStartReview(newRoundNumber, enabledPersonas.map(p => p.id));
    }
  }, [rounds, enabledPersonas, onRoundsChange, onStartReview]);

  // Generate feedback for a persona
  const handleGenerateFeedback = useCallback(async (personaId: string) => {
    if (!onGenerateFeedback || !currentRound) return;
    const newFeedback = await onGenerateFeedback(currentRound.roundNumber, personaId);
    const updatedRounds = rounds.map(r =>
      r.roundNumber === selectedRound
        ? { ...r, feedbackItems: [...r.feedbackItems, ...newFeedback] }
        : r
    );
    onRoundsChange(updatedRounds);
  }, [currentRound, rounds, selectedRound, onGenerateFeedback, onRoundsChange]);

  // Generate scorecard for a persona
  const handleGenerateScorecard = useCallback(async (personaId: string) => {
    if (!onGenerateScorecard || !currentRound) return;
    const newScorecard = await onGenerateScorecard(currentRound.roundNumber, personaId);
    const existingIndex = currentRound.scorecards.findIndex(
      s => s.reviewerPersonaId === personaId && s.roundNumber === currentRound.roundNumber
    );
    let updatedScorecards;
    if (existingIndex >= 0) {
      updatedScorecards = [...currentRound.scorecards];
      updatedScorecards[existingIndex] = newScorecard;
    } else {
      updatedScorecards = [...currentRound.scorecards, newScorecard];
    }
    const updatedRounds = rounds.map(r =>
      r.roundNumber === selectedRound
        ? { ...r, scorecards: updatedScorecards }
        : r
    );
    onRoundsChange(updatedRounds);
  }, [currentRound, rounds, selectedRound, onGenerateScorecard, onRoundsChange]);

  // Complete the current round
  const completeRound = useCallback(() => {
    const updatedRounds = rounds.map(r =>
      r.roundNumber === selectedRound
        ? { ...r, status: 'completed' as ReviewRoundStatus, completedAt: new Date() }
        : r
    );
    onRoundsChange(updatedRounds);
  }, [rounds, selectedRound, onRoundsChange]);

  // Open response dialog
  const openResponseDialog = useCallback((item: ReviewFeedbackItem) => {
    setSelectedFeedbackItem(item);
    setIsResponseDialogOpen(true);
  }, []);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Critical Feedback Alert */}
      {feedbackStats.critical > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Critical Issues Identified</AlertTitle>
          <AlertDescription>
            There are {feedbackStats.critical} critical issue(s) that require immediate attention before proceeding.
          </AlertDescription>
        </Alert>
      )}

      {/* Header Card with Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Internal Review</CardTitle>
                <CardDescription>
                  AI-powered peer review simulation
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <History className="h-3 w-3" />
                Round {selectedRound} of {rounds.length}
              </Badge>
              {currentRound?.status === 'completed' && (
                <Badge className="bg-green-100 text-green-700">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Completed
                </Badge>
              )}
              {currentRound?.status === 'in_progress' && (
                <Badge className="bg-blue-100 text-blue-700">
                  <RefreshCcw className="mr-1 h-3 w-3" />
                  In Progress
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Round Selector */}
          <div className="flex items-center gap-4">
            <Label>Review Round:</Label>
            <Select
              value={selectedRound.toString()}
              onValueChange={(v) => setSelectedRound(parseInt(v))}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rounds.map(round => (
                  <SelectItem key={round.roundNumber} value={round.roundNumber.toString()}>
                    Round {round.roundNumber}
                    {round.status === 'completed' && ' (Completed)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={startNewRound}
              disabled={isProcessing || (currentRound?.status === 'in_progress')}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Round
            </Button>
          </div>

          {/* Feedback Summary Stats */}
          {currentRound && (
            <div className="grid grid-cols-6 gap-3">
              <QuickStat label="Total" value={feedbackStats.total} color="text-gray-600" />
              <QuickStat label="Critical" value={feedbackStats.critical} color="text-red-600" />
              <QuickStat label="Major" value={feedbackStats.major} color="text-orange-600" />
              <QuickStat label="Minor" value={feedbackStats.minor} color="text-yellow-600" />
              <QuickStat label="Suggestions" value={feedbackStats.suggestion} color="text-blue-600" />
              <QuickStat label="Addressed" value={feedbackStats.addressed} color="text-green-600" />
            </div>
          )}

          {/* Overall Score Display */}
          {overallScores && (
            <div className="flex items-center gap-6 p-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <p className="text-3xl font-bold">{overallScores.averageScore.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Average Score</p>
              </div>
              <Separator orientation="vertical" className="h-12" />
              <div className="text-center">
                <p className="text-lg font-medium">{overallScores.minScore.toFixed(1)} - {overallScores.maxScore.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Score Range</p>
              </div>
              <Separator orientation="vertical" className="h-12" />
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">Recommendations:</p>
                <div className="flex gap-1">
                  {overallScores.recommendations.map((rec, idx) => {
                    const config = RECOMMENDATION_CONFIG[rec];
                    return (
                      <Badge key={idx} className={cn('text-xs', config.color)}>
                        {config.label}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConfigDialogOpen(true)}
            >
              <Settings className="mr-2 h-4 w-4" />
              Configure Reviewers
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRubricDialogOpen(true)}
            >
              <FileText className="mr-2 h-4 w-4" />
              Edit Rubric
            </Button>
            {currentRound?.status === 'in_progress' && (
              <Button
                size="sm"
                onClick={completeRound}
                disabled={feedbackStats.total === 0}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Complete Round
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="feedback">
            <MessageSquare className="mr-2 h-4 w-4" />
            Feedback ({feedbackStats.total})
          </TabsTrigger>
          <TabsTrigger value="scorecard">
            <Star className="mr-2 h-4 w-4" />
            Scorecard
          </TabsTrigger>
          <TabsTrigger value="responses">
            <PenLine className="mr-2 h-4 w-4" />
            Responses
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Feedback Tab */}
        <TabsContent value="feedback" className="mt-4">
          <FeedbackPanel
            feedbackByCategory={feedbackByCategory}
            personas={personas}
            expandedCategories={expandedCategories}
            onToggleCategory={toggleCategory}
            onUpdateFeedbackItem={updateFeedbackItem}
            onOpenResponseDialog={openResponseDialog}
            onGenerateFeedback={handleGenerateFeedback}
            enabledPersonas={enabledPersonas}
            isProcessing={isProcessing}
          />
        </TabsContent>

        {/* Scorecard Tab */}
        <TabsContent value="scorecard" className="mt-4">
          <ScorecardPanel
            scorecards={currentRound?.scorecards || []}
            personas={personas}
            rubric={rubric}
            onGenerateScorecard={handleGenerateScorecard}
            onExportScorecard={onExportScorecard}
            enabledPersonas={enabledPersonas}
            isProcessing={isProcessing}
          />
        </TabsContent>

        {/* Responses Tab */}
        <TabsContent value="responses" className="mt-4">
          <ResponsesPanel
            feedbackItems={currentRound?.feedbackItems || []}
            personas={personas}
            onUpdateFeedbackItem={updateFeedbackItem}
            onExportFeedback={onExportFeedback}
          />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4">
          <HistoryPanel
            rounds={rounds}
            personas={personas}
            onSelectRound={setSelectedRound}
          />
        </TabsContent>
      </Tabs>

      {/* Reviewer Configuration Dialog */}
      <ReviewerConfigDialog
        open={isConfigDialogOpen}
        onOpenChange={setIsConfigDialogOpen}
        personas={personas}
        onUpdatePersona={updatePersona}
        onAddPersona={addPersona}
        onRemovePersona={removePersona}
      />

      {/* Rubric Configuration Dialog */}
      <RubricConfigDialog
        open={isRubricDialogOpen}
        onOpenChange={setIsRubricDialogOpen}
        rubric={rubric}
        onUpdateCriterion={updateCriterion}
        onAddCriterion={addCriterion}
        onRemoveCriterion={removeCriterion}
      />

      {/* Response Drafting Dialog */}
      <ResponseDraftDialog
        open={isResponseDialogOpen}
        onOpenChange={setIsResponseDialogOpen}
        feedbackItem={selectedFeedbackItem}
        onUpdateFeedbackItem={updateFeedbackItem}
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

// Feedback Panel
function FeedbackPanel({
  feedbackByCategory,
  personas,
  expandedCategories,
  onToggleCategory,
  onUpdateFeedbackItem,
  onOpenResponseDialog,
  onGenerateFeedback,
  enabledPersonas,
  isProcessing,
}: {
  feedbackByCategory: Partial<Record<FeedbackCategory, ReviewFeedbackItem[]>>;
  personas: ReviewerPersona[];
  expandedCategories: Set<FeedbackCategory>;
  onToggleCategory: (category: FeedbackCategory) => void;
  onUpdateFeedbackItem: (itemId: string, updates: Partial<ReviewFeedbackItem>) => void;
  onOpenResponseDialog: (item: ReviewFeedbackItem) => void;
  onGenerateFeedback: (personaId: string) => Promise<void>;
  enabledPersonas: ReviewerPersona[];
  isProcessing: boolean;
}) {
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  const handleGenerate = async (personaId: string) => {
    setGeneratingFor(personaId);
    try {
      await onGenerateFeedback(personaId);
    } finally {
      setGeneratingFor(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Generate Feedback Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generate Feedback</CardTitle>
          <CardDescription>Select a reviewer persona to generate feedback</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {enabledPersonas.map(persona => {
              const config = PERSONA_CONFIG[persona.type];
              const Icon = config.icon;
              return (
                <Button
                  key={persona.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerate(persona.id)}
                  disabled={isProcessing || generatingFor !== null}
                  className={cn(generatingFor === persona.id && 'animate-pulse')}
                >
                  {generatingFor === persona.id ? (
                    <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className="mr-2 h-4 w-4" />
                  )}
                  {persona.name}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Feedback by Category */}
      <div className="space-y-4">
        {(Object.keys(CATEGORY_CONFIG) as FeedbackCategory[]).map(category => {
          const items = feedbackByCategory[category] || [];
          if (items.length === 0) return null;

          const config = CATEGORY_CONFIG[category];
          const isExpanded = expandedCategories.has(category);
          const Icon = config.icon;

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
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{config.label}</CardTitle>
                          <CardDescription>{config.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{items.length} items</Badge>
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
                      <div className="space-y-3">
                        {items.map(item => (
                          <FeedbackItemCard
                            key={item.id}
                            item={item}
                            persona={personas.find(p => p.id === item.reviewerPersonaId)}
                            onUpdate={(updates) => onUpdateFeedbackItem(item.id, updates)}
                            onOpenResponse={() => onOpenResponseDialog(item)}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}

        {Object.keys(feedbackByCategory).length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                No feedback generated yet
              </p>
              <p className="text-sm text-muted-foreground text-center">
                Select a reviewer persona above to generate feedback
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Feedback Item Card
function FeedbackItemCard({
  item,
  persona,
  onUpdate,
  onOpenResponse,
}: {
  item: ReviewFeedbackItem;
  persona?: ReviewerPersona;
  onUpdate: (updates: Partial<ReviewFeedbackItem>) => void;
  onOpenResponse: () => void;
}) {
  const severityConfig = SEVERITY_CONFIG[item.severity];
  const statusConfig = STATUS_CONFIG[item.status];
  const SeverityIcon = severityConfig.icon;
  const personaConfig = persona ? PERSONA_CONFIG[persona.type] : null;

  return (
    <Card className={cn(
      'transition-colors',
      item.severity === 'critical' && 'border-red-200 bg-red-50/30',
      item.severity === 'major' && 'border-orange-200 bg-orange-50/30',
      item.status === 'addressed' && 'opacity-75'
    )}>
      <CardContent className="py-3">
        <div className="flex items-start gap-3">
          <div className={cn('p-1.5 rounded-full', severityConfig.color)}>
            <SeverityIcon className="h-4 w-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-medium">{item.title}</span>
              <Badge className={cn('text-xs', severityConfig.color)}>
                {severityConfig.label}
              </Badge>
              <Badge className={cn('text-xs', statusConfig.color)}>
                {statusConfig.label}
              </Badge>
              {persona && (
                <Badge variant="outline" className={cn('text-xs', personaConfig?.color)}>
                  {persona.name}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{item.content}</p>

            {item.lineReference && (
              <p className="text-xs text-muted-foreground mt-1">
                <span className="font-medium">Location:</span> {item.lineReference}
              </p>
            )}

            {item.suggestion && (
              <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                <span className="font-medium text-blue-700">Suggestion:</span> {item.suggestion}
              </div>
            )}

            {item.authorResponse && (
              <div className="mt-2 p-2 bg-green-50 rounded text-sm">
                <span className="font-medium text-green-700">Your Response:</span> {item.authorResponse}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Select
              value={item.status}
              onValueChange={(v) => onUpdate({ status: v as FeedbackStatus })}
            >
              <SelectTrigger className="h-8 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="addressed">Addressed</SelectItem>
                <SelectItem value="disputed">Disputed</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenResponse}
            >
              <PenLine className="mr-1 h-4 w-4" />
              Respond
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Scorecard Panel
function ScorecardPanel({
  scorecards,
  personas,
  rubric,
  onGenerateScorecard,
  onExportScorecard,
  enabledPersonas,
  isProcessing,
}: {
  scorecards: ReviewScorecard[];
  personas: ReviewerPersona[];
  rubric: ReviewRubric;
  onGenerateScorecard: (personaId: string) => Promise<void>;
  onExportScorecard?: (format: 'json' | 'md' | 'pdf') => Promise<void>;
  enabledPersonas: ReviewerPersona[];
  isProcessing: boolean;
}) {
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  const handleGenerate = async (personaId: string) => {
    setGeneratingFor(personaId);
    try {
      await onGenerateScorecard(personaId);
    } finally {
      setGeneratingFor(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Generate Scorecard Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Generate Scorecard</CardTitle>
              <CardDescription>Generate detailed review scorecards from AI reviewers</CardDescription>
            </div>
            {scorecards.length > 0 && onExportScorecard && (
              <Select onValueChange={(v) => onExportScorecard(v as 'json' | 'md' | 'pdf')}>
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
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {enabledPersonas.map(persona => {
              const config = PERSONA_CONFIG[persona.type];
              const Icon = config.icon;
              const hasScorecard = scorecards.some(s => s.reviewerPersonaId === persona.id);
              return (
                <Button
                  key={persona.id}
                  variant={hasScorecard ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleGenerate(persona.id)}
                  disabled={isProcessing || generatingFor !== null}
                  className={cn(generatingFor === persona.id && 'animate-pulse')}
                >
                  {generatingFor === persona.id ? (
                    <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className="mr-2 h-4 w-4" />
                  )}
                  {persona.name}
                  {hasScorecard && <CheckCircle className="ml-2 h-3 w-3" />}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Scorecards Display */}
      <div className="grid gap-4 md:grid-cols-2">
        {scorecards.map(scorecard => {
          const persona = personas.find(p => p.id === scorecard.reviewerPersonaId);
          const personaConfig = persona ? PERSONA_CONFIG[persona.type] : null;
          const recommendationConfig = RECOMMENDATION_CONFIG[scorecard.recommendation];
          const RecommendationIcon = recommendationConfig.icon;

          return (
            <Card key={scorecard.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {persona && (
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={persona.avatarUrl} />
                        <AvatarFallback className={cn(personaConfig?.color)}>
                          {persona.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div>
                      <CardTitle className="text-base">{persona?.name || 'Unknown Reviewer'}</CardTitle>
                      <CardDescription>Round {scorecard.roundNumber}</CardDescription>
                    </div>
                  </div>
                  <Badge className={cn('text-sm', recommendationConfig.color)}>
                    <RecommendationIcon className="mr-1 h-4 w-4" />
                    {recommendationConfig.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Overall Score */}
                <div className="flex items-center justify-center gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <p className="text-4xl font-bold">{scorecard.overallScore.toFixed(1)}</p>
                    <p className="text-sm text-muted-foreground">Overall Score</p>
                  </div>
                  <Separator orientation="vertical" className="h-16" />
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(rating => (
                      <Star
                        key={rating}
                        className={cn(
                          'h-6 w-6',
                          rating <= scorecard.overallRating
                            ? 'text-yellow-500 fill-yellow-500'
                            : 'text-gray-300'
                        )}
                      />
                    ))}
                  </div>
                </div>

                {/* Criterion Scores */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Criterion Scores</Label>
                  {scorecard.criterionScores.map(cs => {
                    const criterion = rubric.criteria.find(c => c.id === cs.criterionId);
                    const percentage = (cs.score / cs.maxScore) * 100;
                    return (
                      <div key={cs.criterionId} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{criterion?.name || 'Unknown'}</span>
                          <span className="font-mono">{cs.score}/{cs.maxScore}</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
                </div>

                {/* Strengths and Weaknesses */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <ThumbsUp className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-700">Strengths</span>
                    </div>
                    <p className="text-xs text-green-700">{scorecard.strengthsSummary}</p>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <ThumbsDown className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-medium text-orange-700">Weaknesses</span>
                    </div>
                    <p className="text-xs text-orange-700">{scorecard.weaknessesSummary}</p>
                  </div>
                </div>

                {/* General Comments */}
                {scorecard.generalComments && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm">{scorecard.generalComments}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {scorecards.length === 0 && (
          <Card className="border-dashed md:col-span-2">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Star className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                No scorecards generated yet
              </p>
              <p className="text-sm text-muted-foreground text-center">
                Select a reviewer persona above to generate a scorecard
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Responses Panel
function ResponsesPanel({
  feedbackItems,
  personas,
  onUpdateFeedbackItem,
  onExportFeedback,
}: {
  feedbackItems: ReviewFeedbackItem[];
  personas: ReviewerPersona[];
  onUpdateFeedbackItem: (itemId: string, updates: Partial<ReviewFeedbackItem>) => void;
  onExportFeedback?: (format: 'json' | 'md' | 'pdf') => Promise<void>;
}) {
  const itemsWithResponses = feedbackItems.filter(i => i.authorResponse);
  const itemsPendingResponse = feedbackItems.filter(i => !i.authorResponse && i.severity !== 'positive');

  return (
    <div className="space-y-4">
      {/* Export Button */}
      <div className="flex justify-end">
        {onExportFeedback && feedbackItems.length > 0 && (
          <Select onValueChange={(v) => onExportFeedback(v as 'json' | 'md' | 'pdf')}>
            <SelectTrigger className="w-40">
              <Download className="mr-2 h-4 w-4" />
              Export Responses
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="md">Markdown</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Responded
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{itemsWithResponses.length}</p>
            <p className="text-sm text-muted-foreground">feedback items addressed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-600" />
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">{itemsPendingResponse.length}</p>
            <p className="text-sm text-muted-foreground">feedback items awaiting response</p>
          </CardContent>
        </Card>
      </div>

      {/* Response List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Response Summary</CardTitle>
          <CardDescription>Your responses to reviewer feedback</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {feedbackItems.map(item => {
                const persona = personas.find(p => p.id === item.reviewerPersonaId);
                const severityConfig = SEVERITY_CONFIG[item.severity];

                return (
                  <div key={item.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge className={cn('text-xs', severityConfig.color)}>
                            {severityConfig.label}
                          </Badge>
                          {persona && (
                            <Badge variant="outline" className="text-xs">
                              {persona.name}
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium mt-1">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.content}</p>
                      </div>
                    </div>

                    {item.authorResponse ? (
                      <div className="p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-700">Your Response</span>
                        </div>
                        <p className="text-sm text-green-800">{item.authorResponse}</p>
                      </div>
                    ) : (
                      <div className="p-3 bg-orange-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-orange-600" />
                          <span className="text-sm text-orange-700">Response pending</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {feedbackItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No feedback to respond to yet</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// History Panel
function HistoryPanel({
  rounds,
  personas,
  onSelectRound,
}: {
  rounds: ReviewRound[];
  personas: ReviewerPersona[];
  onSelectRound: (roundNumber: number) => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-5 w-5" />
            Review History
          </CardTitle>
          <CardDescription>Track progress across multiple review rounds</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {rounds.map(round => {
                const feedbackCount = round.feedbackItems.length;
                const addressedCount = round.feedbackItems.filter(i => i.status === 'addressed').length;
                const criticalCount = round.feedbackItems.filter(i => i.severity === 'critical').length;
                const averageScore = round.scorecards.length > 0
                  ? round.scorecards.reduce((a, b) => a + b.overallScore, 0) / round.scorecards.length
                  : null;

                return (
                  <Card
                    key={round.id}
                    className={cn(
                      'cursor-pointer hover:bg-muted/50 transition-colors',
                      round.status === 'in_progress' && 'border-blue-200'
                    )}
                    onClick={() => onSelectRound(round.roundNumber)}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            'p-3 rounded-full',
                            round.status === 'completed' && 'bg-green-100',
                            round.status === 'in_progress' && 'bg-blue-100',
                            round.status === 'draft' && 'bg-gray-100'
                          )}>
                            <span className="text-lg font-bold">R{round.roundNumber}</span>
                          </div>
                          <div>
                            <p className="font-medium">Round {round.roundNumber}</p>
                            <p className="text-sm text-muted-foreground">
                              {round.startedAt?.toLocaleDateString()}
                              {round.completedAt && ` - ${round.completedAt.toLocaleDateString()}`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <p className="text-lg font-bold">{feedbackCount}</p>
                            <p className="text-xs text-muted-foreground">Feedback</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-green-600">{addressedCount}</p>
                            <p className="text-xs text-muted-foreground">Addressed</p>
                          </div>
                          {criticalCount > 0 && (
                            <div className="text-center">
                              <p className="text-lg font-bold text-red-600">{criticalCount}</p>
                              <p className="text-xs text-muted-foreground">Critical</p>
                            </div>
                          )}
                          {averageScore !== null && (
                            <div className="text-center">
                              <p className="text-lg font-bold">{averageScore.toFixed(1)}</p>
                              <p className="text-xs text-muted-foreground">Avg Score</p>
                            </div>
                          )}
                          <Badge className={cn(
                            round.status === 'completed' && 'bg-green-100 text-green-700',
                            round.status === 'in_progress' && 'bg-blue-100 text-blue-700',
                            round.status === 'draft' && 'bg-gray-100 text-gray-700'
                          )}>
                            {round.status === 'completed' && <CheckCircle className="mr-1 h-3 w-3" />}
                            {round.status === 'in_progress' && <RefreshCcw className="mr-1 h-3 w-3" />}
                            {round.status.replace('_', ' ')}
                          </Badge>
                          <ArrowRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>

                      {round.notes && (
                        <p className="text-sm text-muted-foreground mt-2 border-t pt-2">
                          {round.notes}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              {rounds.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <History className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No review rounds yet</p>
                  <p className="text-sm text-muted-foreground">Start a new review round to begin</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== Dialogs ====================

// Reviewer Configuration Dialog
function ReviewerConfigDialog({
  open,
  onOpenChange,
  personas,
  onUpdatePersona,
  onAddPersona,
  onRemovePersona,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personas: ReviewerPersona[];
  onUpdatePersona: (personaId: string, updates: Partial<ReviewerPersona>) => void;
  onAddPersona: (type: ReviewerPersonaType) => void;
  onRemovePersona: (personaId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Configure AI Reviewers</DialogTitle>
          <DialogDescription>
            Customize reviewer personas for your internal review
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-4">
            {/* Add New Persona */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Add Reviewer Persona</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(PERSONA_CONFIG) as ReviewerPersonaType[]).map(type => {
                    const config = PERSONA_CONFIG[type];
                    const Icon = config.icon;
                    return (
                      <Button
                        key={type}
                        variant="outline"
                        size="sm"
                        onClick={() => onAddPersona(type)}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        {config.label}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Existing Personas */}
            {personas.map(persona => {
              const config = PERSONA_CONFIG[persona.type];
              const Icon = config.icon;

              return (
                <Card key={persona.id} className={cn(!persona.isEnabled && 'opacity-50')}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn('p-2 rounded-lg', config.color)}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <Input
                            value={persona.name}
                            onChange={(e) => onUpdatePersona(persona.id, { name: e.target.value })}
                            className="h-8 font-medium"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={persona.isEnabled}
                          onCheckedChange={(checked) =>
                            onUpdatePersona(persona.id, { isEnabled: !!checked })
                          }
                        />
                        <Label className="text-sm">Enabled</Label>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => onRemovePersona(persona.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={persona.description}
                        onChange={(e) => onUpdatePersona(persona.id, { description: e.target.value })}
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Strictness Level: {persona.strictness}</Label>
                      <Slider
                        value={[persona.strictness]}
                        onValueChange={([v]) => onUpdatePersona(persona.id, { strictness: v })}
                        min={1}
                        max={5}
                        step={1}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Lenient</span>
                        <span>Strict</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Focus Areas</Label>
                      <div className="flex flex-wrap gap-2">
                        {(Object.keys(CATEGORY_CONFIG) as FeedbackCategory[]).map(cat => (
                          <Badge
                            key={cat}
                            variant={persona.focusAreas.includes(cat) ? 'default' : 'outline'}
                            className="cursor-pointer"
                            onClick={() => {
                              const newAreas = persona.focusAreas.includes(cat)
                                ? persona.focusAreas.filter(a => a !== cat)
                                : [...persona.focusAreas, cat];
                              onUpdatePersona(persona.id, { focusAreas: newAreas });
                            }}
                          >
                            {CATEGORY_CONFIG[cat].label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Rubric Configuration Dialog
function RubricConfigDialog({
  open,
  onOpenChange,
  rubric,
  onUpdateCriterion,
  onAddCriterion,
  onRemoveCriterion,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rubric: ReviewRubric;
  onUpdateCriterion: (criterionId: string, updates: Partial<RubricCriterion>) => void;
  onAddCriterion: () => void;
  onRemoveCriterion: (criterionId: string) => void;
}) {
  const totalWeight = rubric.criteria.reduce((a, b) => a + b.weight, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Edit Review Rubric</DialogTitle>
          <DialogDescription>
            Customize the criteria used to evaluate your research
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm">Total Weight: {totalWeight}%</span>
            {totalWeight !== 100 && (
              <Badge variant="destructive">Should equal 100%</Badge>
            )}
          </div>

          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-3 pr-4">
              {rubric.criteria.map(criterion => (
                <Card key={criterion.id}>
                  <CardContent className="py-3">
                    <div className="grid gap-3">
                      <div className="flex items-center gap-2">
                        <Input
                          value={criterion.name}
                          onChange={(e) => onUpdateCriterion(criterion.id, { name: e.target.value })}
                          placeholder="Criterion name"
                          className="flex-1"
                        />
                        <Select
                          value={criterion.category}
                          onValueChange={(v) => onUpdateCriterion(criterion.id, { category: v as FeedbackCategory })}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(CATEGORY_CONFIG) as FeedbackCategory[]).map(cat => (
                              <SelectItem key={cat} value={cat}>
                                {CATEGORY_CONFIG[cat].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => onRemoveCriterion(criterion.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <Textarea
                        value={criterion.description}
                        onChange={(e) => onUpdateCriterion(criterion.id, { description: e.target.value })}
                        placeholder="Description"
                        rows={2}
                      />

                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Weight (%)</Label>
                          <Input
                            type="number"
                            value={criterion.weight}
                            onChange={(e) => onUpdateCriterion(criterion.id, { weight: parseInt(e.target.value) || 0 })}
                            min={0}
                            max={100}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Max Score</Label>
                          <Input
                            type="number"
                            value={criterion.maxScore}
                            onChange={(e) => onUpdateCriterion(criterion.id, { maxScore: parseInt(e.target.value) || 0 })}
                            min={1}
                          />
                        </div>
                        <div className="flex items-end">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={criterion.isRequired}
                              onCheckedChange={(checked) =>
                                onUpdateCriterion(criterion.id, { isRequired: !!checked })
                              }
                            />
                            <Label className="text-sm">Required</Label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onAddCriterion}>
            <Plus className="mr-2 h-4 w-4" />
            Add Criterion
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Response Drafting Dialog
function ResponseDraftDialog({
  open,
  onOpenChange,
  feedbackItem,
  onUpdateFeedbackItem,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feedbackItem: ReviewFeedbackItem | null;
  onUpdateFeedbackItem: (itemId: string, updates: Partial<ReviewFeedbackItem>) => void;
}) {
  const [response, setResponse] = useState('');
  const [status, setStatus] = useState<FeedbackStatus>('addressed');

  React.useEffect(() => {
    if (feedbackItem) {
      setResponse(feedbackItem.authorResponse || '');
      setStatus(feedbackItem.status);
    }
  }, [feedbackItem]);

  if (!feedbackItem) return null;

  const severityConfig = SEVERITY_CONFIG[feedbackItem.severity];

  const handleSave = () => {
    onUpdateFeedbackItem(feedbackItem.id, {
      authorResponse: response,
      status: status,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Respond to Feedback</DialogTitle>
          <DialogDescription>
            Draft your response to reviewer feedback
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Original Feedback */}
          <Card className={cn('border', severityConfig.color)}>
            <CardContent className="py-3">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={cn('text-xs', severityConfig.color)}>
                  {severityConfig.label}
                </Badge>
              </div>
              <p className="font-medium">{feedbackItem.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{feedbackItem.content}</p>

              {feedbackItem.suggestion && (
                <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                  <span className="font-medium text-blue-700">Suggestion:</span> {feedbackItem.suggestion}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Response Input */}
          <div className="space-y-2">
            <Label>Your Response</Label>
            <Textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Write your response to this feedback..."
              rows={5}
            />
          </div>

          {/* Status Selection */}
          <div className="space-y-2">
            <Label>Update Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as FeedbackStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="addressed">Addressed - Changes made as suggested</SelectItem>
                <SelectItem value="acknowledged">Acknowledged - Noted but not changed</SelectItem>
                <SelectItem value="disputed">Disputed - Disagree with feedback</SelectItem>
                <SelectItem value="pending">Pending - Still working on it</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Send className="mr-2 h-4 w-4" />
            Save Response
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default Stage13InternalReview;
