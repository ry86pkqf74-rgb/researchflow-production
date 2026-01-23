import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { safeFixed, formatBytes } from "@/lib/format";
import { useWorkflowPersistence } from "@/hooks/use-workflow-persistence";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  FileText, BookOpen, Database, Shield, CheckCircle, BarChart3, 
  Search, Lightbulb, Calculator, FileEdit, RefreshCw, Sparkles,
  ChevronRight, Clock, Check, FileStack, ShieldCheck, Send,
  Presentation, Image, Users, Monitor, PenTool, Wand2, FileCheck,
  MousePointerClick, TableProperties, Eraser, ClipboardCheck,
  Target, ArrowDownRight, ArrowUpRight, Zap, Link2, Play, Loader2,
  RotateCcw, Eye, FileCode, Table, List, ChevronDown, ChevronUp,
  Upload, X, HardDrive, FileSpreadsheet, AlertCircle,
  Lock, History, Bot, Download
} from "lucide-react";
import { AttestationModal, type AttestationResult } from "@/components/ui/attestation-modal";
import { useAIApprovalGate } from "@/components/ui/ai-approval-gate";
import { usePhiGate, PhiStatusBadge } from "@/components/ui/phi-gate";
import { PhiGate } from "@/components/phi";
import {
  type LifecycleState,
  type AuditLogEntry,
  type AttestationGate,
  getAttestationGateForStage,
  mapStageToLifecycleState,
  createAuditEntry,
  STATE_METADATA,
  isValidTransition,
  requiresAttestation,
  isImmutable,
  canExecuteInCurrentState,
  stageUsesAI,
  getAIToolsForStage,
  stageRequiresAttestation,
  stageRequiresPhiGate,
} from "@/lib/governance";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { WorkflowStageGroup, WorkflowStage, StageExecutionResult, TopicVersion, TopicVersionHistory, TopicScopeValues } from "@packages/core/types";
import { ResearchBriefPanel, TopicVersionBadge, createVersionHash } from "@/components/ui/research-brief";
import { SapBuilderPanel } from "@/components/ui/sap-builder";
import { ConferenceReadinessPanel } from "@/components/ui/conference-readiness";
import { IrbPanel } from "@/components/ui/irb-panel";
import { SummaryChartsSection } from "@/components/ui/summary-charts";
import { FairnessMetrics } from "@/components/ui/fairness-metrics";
import { TopicBriefPanel } from "@/components/ui/topic-brief-panel";
import { AIResearchBriefPanel } from "@/components/research-brief";
import { WorkflowSidebar } from "@/components/sections/workflow-sidebar";
import { AIConsentModal, type AIConsentResult } from "@/components/ui/ai-consent-modal";
import { useAIAuthorizationStore } from "@/stores/ai-authorization-store";
import { TopicCardRecommendations, type TopicRecommendationsData } from "@/components/ui/topic-card-recommendations";
import { useAI } from "@/hooks/useAI";
import { useAIWithRetry } from "@/hooks/useAIWithRetry";
import { type PhaseGroupInfo, type WorkflowStageInfo } from "@/components/ui/progress-stepper";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText, BookOpen, Database, Shield, CheckCircle, BarChart3,
  Search, Lightbulb, Calculator, FileEdit, RefreshCw, Sparkles,
  FileStack, ShieldCheck, Send, Presentation, Image, Users, Monitor,
  PenTool, Wand2, FileCheck, MousePointerClick, TableProperties, Eraser,
  ClipboardCheck
};

const outputTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  text: FileText,
  table: Table,
  list: List,
  document: FileCode,
  chart: BarChart3
};

interface ExecutionState {
  [stageId: number]: {
    status: 'idle' | 'executing' | 'completed' | 'error';
    result?: StageExecutionResult;
  };
}

function getGroupStatus(stages: WorkflowStage[], executionState: ExecutionState): 'completed' | 'active' | 'pending' {
  const hasActive = stages.some(s => executionState[s.id]?.status === 'executing');
  const allCompleted = stages.every(s => executionState[s.id]?.status === 'completed');
  const hasCompleted = stages.some(s => executionState[s.id]?.status === 'completed');
  
  if (allCompleted) return 'completed';
  if (hasActive || hasCompleted) return 'active';
  return 'pending';
}

function getGroupProgress(stages: WorkflowStage[], executionState: ExecutionState): number {
  const completed = stages.filter(s => executionState[s.id]?.status === 'completed').length;
  return Math.round((completed / stages.length) * 100);
}

export function WorkflowPipeline() {
  const { data: stageGroups, isLoading } = useQuery<WorkflowStageGroup[]>({
    queryKey: ["/api/workflow/stages"],
  });

  const { loadWorkflowState, autoSaveWorkflowState, clearWorkflowState } = useWorkflowPersistence();

  const [selectedStage, setSelectedStage] = useState<WorkflowStage | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["data-preparation"]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [executionState, setExecutionState] = useState<ExecutionState>({});
  const [executionPending, setExecutionPending] = useState<Record<number, boolean>>({});
  const [expandedOutputs, setExpandedOutputs] = useState<Record<string, boolean>>({});
  const [scopeValuesByStage, setScopeValuesByStage] = useState<Record<number, Record<string, string>>>({});
  const [appliedSuggestionsByStage, setAppliedSuggestionsByStage] = useState<Record<number, Set<number>>>({});
  
  // Topic Version Tracking for Stage 1
  const [topicVersionHistory, setTopicVersionHistory] = useState<TopicVersionHistory>({
    currentVersion: 0,
    versions: [],
  });
  const [isTopicLocked, setIsTopicLocked] = useState(false);
  const scopeVersionDebounceRef = useRef<number | null>(null);
  const lastAutoVersionedScopeRef = useRef<string>('');
  
  // Data upload state for Phase 2
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    size: number;
    type: string;
    uploadedAt: Date;
    status: 'uploading' | 'uploaded' | 'validated' | 'error';
    recordCount?: number;
    variableCount?: number;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const uploadTimeoutsRef = useRef<number[]>([]);

  // Manuscript selection state for Stage 11 (Manuscript Ideation)
  const [selectedManuscript, setSelectedManuscript] = useState<{
    id: number;
    title: string;
    relevance: number;
    novelty: number;
    feasibility: number;
    targetJournals: string[];
  } | null>(null);

  // Journal selection state for Stage 16 (Journal Selection)
  const [selectedJournal, setSelectedJournal] = useState<{
    id: string;
    name: string;
    impactFactor: number;
    acceptanceRate: string;
    reviewTime: string;
    strengths: string[];
    weaknesses: string[];
    fitScore: number;
    openAccess: boolean;
    publicationFee?: string;
  } | null>(null);

  // Research overview statement per stage (primary input for Topic Declaration)
  const [overviewByStage, setOverviewByStage] = useState<Record<number, string>>({});
  const [showPicoRefinement, setShowPicoRefinement] = useState(false);

  // AI Recommendations State
  const [aiRecommendations, setAiRecommendations] = useState<TopicRecommendationsData | null>(null);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const { isAuthorized, authorize } = useAIAuthorizationStore();

  // Governance lifecycle state management
  const [lifecycleState, setLifecycleState] = useState<LifecycleState>('DRAFT');
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [pendingAttestation, setPendingAttestation] = useState<{
    gate: AttestationGate;
    stageId: number;
    stageName: string;
  } | null>(null);
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [isDownloadingBundle, setIsDownloadingBundle] = useState(false);

  // PHI Gate Modal State
  const [phiGateOpen, setPhiGateOpen] = useState(false);
  const [phiGateStageId, setPhiGateStageId] = useState<number | null>(null);
  const [pendingPhiGateCallback, setPendingPhiGateCallback] = useState<(() => void) | null>(null);

  // AI Approval System from context
  const { requestApproval: requestAIApproval, checkApproval: isStageAIApproved } = useAIApprovalGate();
  
  // PHI Gate System from context (keeping for phiStatus display, requestGateCheck unused with new PhiGate component)
  const { phiStatus } = usePhiGate();

  // AI hook for API calls with authorization and retry
  const { generateContent } = useAI();
  const { generateWithRetry } = useAIWithRetry();

  // Add audit log entry
  const addAuditEntry = (entry: AuditLogEntry) => {
    setAuditLog(prev => [entry, ...prev]);
  };

  // Handle lifecycle state transition
  const transitionLifecycleState = (newState: LifecycleState, reason?: string, attestedBy?: string) => {
    if (!isValidTransition(lifecycleState, newState)) {
      console.warn(`Invalid lifecycle transition: ${lifecycleState} -> ${newState}`);
      addAuditEntry(createAuditEntry('GATE_BLOCKED', {
        stateFrom: lifecycleState,
        stateTo: newState,
        reason: `Invalid transition blocked: ${lifecycleState} -> ${newState}`,
      }));
      return false;
    }

    addAuditEntry(createAuditEntry('STATE_CHANGE', {
      stateFrom: lifecycleState,
      stateTo: newState,
      attestedBy,
      reason,
    }));

    setLifecycleState(newState);
    return true;
  };

  // Check if stage execution requires attestation
  const checkAttestationRequired = (stageId: number, stageName: string): boolean => {
    const gate = getAttestationGateForStage(stageId);
    if (gate) {
      const targetState = mapStageToLifecycleState(stageId);
      if (requiresAttestation(targetState) || gate.requiredForStages.includes(stageId)) {
        setPendingAttestation({ gate, stageId, stageName });
        return true;
      }
    }
    return false;
  };

  // Handle attestation confirmation
  const handleAttestationConfirm = (result: AttestationResult) => {
    if (!pendingAttestation) return;

    addAuditEntry(createAuditEntry('ATTESTATION_PROVIDED', {
      stageId: pendingAttestation.stageId,
      stageName: pendingAttestation.stageName,
      attestedBy: result.attestedBy,
      reason: `Confirmed: ${result.checkedItems.join('; ')}`,
    }));

    const targetState = mapStageToLifecycleState(pendingAttestation.stageId);
    const transitionSuccess = transitionLifecycleState(targetState, 'Attestation gate passed', result.attestedBy);

    if (!transitionSuccess) {
      // State transition failed, don't execute
      setPendingAttestation(null);
      return;
    }

    // Log stage execution after attestation
    addAuditEntry(createAuditEntry('STAGE_EXECUTED', {
      stageId: pendingAttestation.stageId,
      stageName: pendingAttestation.stageName,
      attestedBy: result.attestedBy,
    }));

    // Execute the stage after attestation
    executeStageAfterAttestation(pendingAttestation.stageId);
    setPendingAttestation(null);
  };

  // Handle attestation cancellation
  const handleAttestationCancel = () => {
    if (!pendingAttestation) return;
    
    addAuditEntry(createAuditEntry('GATE_BLOCKED', {
      stageId: pendingAttestation.stageId,
      stageName: pendingAttestation.stageName,
      reason: 'Attestation cancelled by user',
    }));
    
    setPendingAttestation(null);
  };

  // Execute stage after attestation is confirmed
  const executeStageAfterAttestation = (stageId: number) => {
    let body: Record<string, unknown> | undefined;
    const stage1Scope = scopeValuesByStage[1];
    const topicText = stage1Scope?.population 
      ? `${stage1Scope.population} ${stage1Scope.outcomes ? `with outcomes: ${stage1Scope.outcomes}` : ''}`
      : "Subclinical hypothyroidism and cardiovascular outcomes";

    if (stageId === 2) {
      body = { topic: topicText };
    } else if (stageId === 4) {
      const stage2Result = executionState[2]?.result;
      const listOutput = stage2Result?.outputs?.find(o => o.type === 'list');
      body = {
        topic: topicText,
        literatureInsights: listOutput?.content ? listOutput.content.split('\n').filter(Boolean) : [],
      };
    }

    executeMutation.mutate({ stageId, body });
  };

  const getCurrentOverview = () => {
    if (!selectedStage) return "";
    return overviewByStage[selectedStage.id] || "";
  };

  const handleOverviewChange = (value: string) => {
    if (!selectedStage) return;
    setOverviewByStage(prev => ({
      ...prev,
      [selectedStage.id]: value
    }));
  };

  // Handle AI Insights Request
  const handleRequestAIInsights = async () => {
    if (!selectedStage || selectedStage.id !== 1) return;
    
    const overview = getCurrentOverview();
    if (!overview || overview.trim().length < 20) {
      alert('Please provide a more detailed research overview (at least 20 characters)');
      return;
    }

    const scope = 'topic-declaration-recommendations';
    
    // Check if already authorized
    if (!isAuthorized(scope)) {
      setShowConsentModal(true);
      return;
    }

    // Already authorized, fetch recommendations
    await fetchRecommendations();
  };

  // Handle authorization from consent modal
  const handleAuthorizeAI = async (result: AIConsentResult) => {
    console.log('[AI] Authorization received:', result);
    authorize(result);
    addAuditEntry(createAuditEntry('AI_APPROVAL', {
      stageId: 1,
      stageName: 'Topic Declaration',
      approvedBy: result.authorizedBy,
      reason: `AI recommendations authorized for ${result.scope}`,
    }));
    
    console.log('[AI] Fetching recommendations...');
    // Fetch recommendations after authorization
    await fetchRecommendations();
  };

  // Fetch AI recommendations from API (now using useAI hook with authorization)
  const fetchRecommendations = async () => {
    console.log('[AI] fetchRecommendations called');
    setIsLoadingRecommendations(true);

    try {
      const overview = getCurrentOverview();
      const currentValues = getCurrentScopeValues();

      console.log('[AI] Sending request to /api/ai/topic-recommendations', {
        overview: overview?.substring(0, 50) + '...',
        currentValues,
      });

      // Use the useAIWithRetry hook which handles authorization, validation, and automatic retries
      const response = await generateWithRetry<TopicRecommendationsData>(
        'ai/topic-recommendations',
        {
          researchOverview: overview,
          currentValues,
        },
        {
          stageId: 1,
          stageName: 'Topic Declaration',
          maxRetries: 2, // Retry twice on network failures
        }
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch recommendations');
      }

      setAiRecommendations(response.data);

      addAuditEntry(createAuditEntry('AI_INTERACTION', {
        stageId: 1,
        stageName: 'Topic Declaration',
        reason: `AI recommendations generated (strength: ${response.data.overallAssessment.strength})`,
        approvedBy: response.approvedBy,
      }));
    } catch (error) {
      console.error('Error fetching AI recommendations:', error);
      alert('Failed to generate AI recommendations. Please try again.');
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  // Apply recommendation to field
  const handleApplyRecommendation = (field: string, suggestion: string) => {
    if (!selectedStage) return;
    
    handleScopeChange(field, suggestion);
    
    addAuditEntry(createAuditEntry('AI_INTERACTION', {
      stageId: 1,
      stageName: 'Topic Declaration',
      reason: `Applied AI recommendation to ${field}`,
    }));
  };

  // Dismiss recommendations
  const handleDismissRecommendations = () => {
    setAiRecommendations(null);
  };

  const getCurrentScopeValues = () => {
    if (!selectedStage) return {};
    return scopeValuesByStage[selectedStage.id] || {};
  };

  const getAppliedSuggestions = () => {
    if (!selectedStage) return new Set<number>();
    return appliedSuggestionsByStage[selectedStage.id] || new Set<number>();
  };

  const handleScopeChange = (fieldId: string, value: string) => {
    if (!selectedStage) return;
    if (selectedStage.id === 1 && isTopicLocked) return;
    
    setScopeValuesByStage(prev => ({
      ...prev,
      [selectedStage.id]: {
        ...(prev[selectedStage.id] || {}),
        [fieldId]: value
      }
    }));
  };
  
  const createTopicVersion = (
    scopeValues: TopicScopeValues,
    changeType: TopicVersion['changeType'],
    changeDescription?: string,
    aiSuggestionsApplied?: number[]
  ) => {
    if (isTopicLocked) return;
    
    const newVersion: TopicVersion = {
      version: topicVersionHistory.currentVersion + 1,
      timestamp: new Date().toISOString(),
      scopeValues,
      changeType,
      changeDescription,
      aiSuggestionsApplied,
      sha256Hash: createVersionHash(scopeValues),
    };
    
    setTopicVersionHistory(prev => ({
      currentVersion: newVersion.version,
      versions: [...prev.versions, newVersion],
    }));
    
    addAuditEntry(createAuditEntry('STATE_CHANGE', {
      stageId: 1,
      stageName: 'Topic Declaration',
      reason: `Topic version ${newVersion.version} created: ${changeDescription || changeType}`,
      metadata: { topicVersion: newVersion.version, changeType },
    }));
    
    return newVersion;
  };
  
  const handleSaveTopicVersion = () => {
    const currentScope = scopeValuesByStage[1] || {};
    if (Object.keys(currentScope).length === 0) return;
    
    const hasExistingVersion = topicVersionHistory.versions.some(
      v => JSON.stringify(v.scopeValues) === JSON.stringify(currentScope)
    );
    
    if (!hasExistingVersion) {
      const isInitial = topicVersionHistory.currentVersion === 0;
      createTopicVersion(
        currentScope as TopicScopeValues,
        isInitial ? 'initial' : 'refinement',
        isInitial ? 'Initial topic definition' : 'Manual topic refinement'
      );
    }
  };
  
  const handleLockTopic = () => {
    if (topicVersionHistory.currentVersion === 0) return;
    
    setIsTopicLocked(true);
    setTopicVersionHistory(prev => ({
      ...prev,
      lockedAt: new Date().toISOString(),
      lockedBy: 'Current User',
    }));
    
    addAuditEntry(createAuditEntry('STATE_CHANGE', {
      stageId: 1,
      stageName: 'Topic Declaration',
      reason: `Topic locked at version ${topicVersionHistory.currentVersion}`,
    }));
  };
  
  // Debounced auto-version creation on scope changes
  useEffect(() => {
    const stage1Scope = scopeValuesByStage[1];
    if (!stage1Scope || isTopicLocked) return;
    
    const scopeJson = JSON.stringify(stage1Scope);
    const hasContent = Object.values(stage1Scope).some(v => v && v.trim().length > 0);
    
    if (!hasContent || scopeJson === lastAutoVersionedScopeRef.current) return;
    
    if (scopeVersionDebounceRef.current) {
      clearTimeout(scopeVersionDebounceRef.current);
    }
    
    scopeVersionDebounceRef.current = window.setTimeout(() => {
      const hasExistingVersion = topicVersionHistory.versions.some(
        v => JSON.stringify(v.scopeValues) === scopeJson
      );
      
      if (!hasExistingVersion) {
        const isInitial = topicVersionHistory.currentVersion === 0;
        createTopicVersion(
          stage1Scope as TopicScopeValues,
          isInitial ? 'initial' : 'refinement',
          isInitial ? 'Initial topic definition' : 'Auto-saved topic refinement'
        );
        lastAutoVersionedScopeRef.current = scopeJson;
      }
    }, 3000);
    
    return () => {
      if (scopeVersionDebounceRef.current) {
        clearTimeout(scopeVersionDebounceRef.current);
      }
    };
  }, [scopeValuesByStage, isTopicLocked, topicVersionHistory.currentVersion, topicVersionHistory.versions]);

  const handleApplySuggestion = (suggestion: { type: string; text: string }, index: number) => {
    if (!selectedStage) return;
    const text = suggestion.text;
    const stageId = selectedStage.id;
    
    setScopeValuesByStage(prev => {
      const currentStageValues = prev[stageId] || {};
      const newValues = { ...currentStageValues };
      
      if (suggestion.type === 'narrow') {
        const currentPop = newValues.population || "";
        newValues.population = currentPop 
          ? `${currentPop}; ${text}` 
          : text;
      } else if (suggestion.type === 'expand') {
        const currentOutcomes = newValues.outcomes || "";
        newValues.outcomes = currentOutcomes 
          ? `${currentOutcomes}; ${text}` 
          : text;
      } else if (suggestion.type === 'improve') {
        if (text.toLowerCase().includes('propensity') || 
            text.toLowerCase().includes('matching') ||
            text.toLowerCase().includes('confound')) {
          const currentComp = newValues.comparator || "";
          newValues.comparator = currentComp 
            ? `${currentComp}; ${text}` 
            : text;
        } else if (text.toLowerCase().includes('stratif') || 
                   text.toLowerCase().includes('subgroup')) {
          const currentPop = newValues.population || "";
          newValues.population = currentPop 
            ? `${currentPop}; ${text}` 
            : text;
        } else {
          const currentOutcomes = newValues.outcomes || "";
          newValues.outcomes = currentOutcomes 
            ? `${currentOutcomes}; ${text}` 
            : text;
        }
      }
      
      if (stageId === 1 && !isTopicLocked) {
        setTimeout(() => {
          createTopicVersion(
            newValues as TopicScopeValues,
            'ai_suggestion',
            `Applied AI suggestion: ${suggestion.type}`,
            [index]
          );
        }, 100);
      }
      
      return { ...prev, [stageId]: newValues };
    });
    
    setAppliedSuggestionsByStage(prev => {
      const currentSet = prev[stageId] || new Set<number>();
      const newSet = new Set(currentSet);
      newSet.add(index);
      return { ...prev, [stageId]: newSet };
    });
  };

  const executeMutation = useMutation({
    mutationFn: async ({ stageId, body }: { stageId: number; body?: Record<string, unknown> }) => {
      const response = await apiRequest("POST", `/api/workflow/execute/${stageId}`, body);
      return response.json() as Promise<StageExecutionResult>;
    },
    onMutate: ({ stageId }) => {
      setExecutionState(prev => ({
        ...prev,
        [stageId]: { status: 'executing' }
      }));
    },
    onSuccess: (result) => {
      setExecutionState(prev => ({
        ...prev,
        [result.stageId]: { status: 'completed', result }
      }));
    },
    onError: (_, { stageId }) => {
      setExecutionState(prev => ({
        ...prev,
        [stageId]: { status: 'error' }
      }));
    }
  });

  useEffect(() => {
    if (stageGroups && !selectedStage) {
      const allStages = stageGroups.flatMap(g => g.stages);
      setSelectedStage(allStages[0]);
    }
  }, [stageGroups, selectedStage]);

  // Load persisted workflow state on mount
  useEffect(() => {
    const savedState = loadWorkflowState();
    if (savedState) {
      setExpandedGroups(savedState.expandedGroups);
      setExecutionState(savedState.executionState as ExecutionState);
      setScopeValuesByStage(savedState.scopeValuesByStage);
      setTopicVersionHistory(savedState.topicVersionHistory as TopicVersionHistory);
      setIsTopicLocked(savedState.isTopicLocked);
      setOverviewByStage(savedState.overviewByStage);
      setLifecycleState(savedState.lifecycleState as LifecycleState);
    }
  }, []);

  // Auto-save workflow state when key values change
  useEffect(() => {
    autoSaveWorkflowState({
      expandedGroups,
      executionState,
      scopeValuesByStage,
      topicVersionHistory,
      isTopicLocked,
      selectedManuscriptId: selectedManuscript?.id || null,
      selectedJournalId: selectedJournal?.id || null,
      overviewByStage,
      lifecycleState,
    });
  }, [expandedGroups, executionState, scopeValuesByStage, topicVersionHistory, isTopicLocked, selectedManuscript, selectedJournal, overviewByStage, lifecycleState]);

  // Handle reset workflow progress
  const handleResetProgress = () => {
    clearWorkflowState();
    window.location.reload();
  };

  // Cleanup upload timeouts on unmount
  useEffect(() => {
    return () => {
      uploadTimeoutsRef.current.forEach(id => clearTimeout(id));
    };
  }, []);

  // PHI-gated stages: 9 (Summary Characteristics), 13 (Statistical Analysis), 14 (Manuscript Drafting),
  // 17 (Poster Preparation), 18 (Symposium Materials), 19 (Presentation Preparation)
  const PHI_GATED_STAGES = [9, 13, 14, 17, 18, 19];

  // Check if a stage requires PHI gate and open modal if so
  // Returns true if blocked (modal opened), false if can proceed immediately
  const checkPhiGate = (stageId: number, onPass: () => void): boolean => {
    if (PHI_GATED_STAGES.includes(stageId)) {
      setPhiGateStageId(stageId);
      setPendingPhiGateCallback(() => onPass);
      setPhiGateOpen(true);
      return true; // Blocked - modal opened
    }
    return false; // Not gated - proceed immediately
  };

  // Handle PHI gate pass - execute pending callback and close modal
  const handlePhiGatePass = () => {
    if (pendingPhiGateCallback) {
      pendingPhiGateCallback();
    }
    setPhiGateOpen(false);
    setPhiGateStageId(null);
    setPendingPhiGateCallback(null);
  };

  // Handle PHI gate fail or cancel - close modal without executing
  const handlePhiGateClose = () => {
    if (phiGateStageId) {
      const allStages = stageGroups?.flatMap(g => g.stages) || [];
      const stage = allStages.find(s => s.id === phiGateStageId);
      const stageName = stage?.name || `Stage ${phiGateStageId}`;
      addAuditEntry(createAuditEntry('GATE_BLOCKED', {
        stageId: phiGateStageId,
        stageName,
        reason: 'PHI gate check failed or cancelled',
        metadata: { phiStatus: 'BLOCKED' },
      }));
    }
    setPhiGateOpen(false);
    setPhiGateStageId(null);
    setPendingPhiGateCallback(null);
  };

  const handleExecuteStage = async (stageId: number) => {
    // Prevent double-clicks
    if (executionPending[stageId]) return;

    setExecutionPending(prev => ({ ...prev, [stageId]: true }));
    try {
      // Reset selected manuscript if re-executing Stage 11
      if (stageId === 11) {
        setSelectedManuscript(null);
      }
      // Reset selected journal if re-executing Stage 16
      if (stageId === 16) {
        setSelectedJournal(null);
      }

      // Get stage name for attestation
      const allStages = stageGroups?.flatMap(g => g.stages) || [];
      const stage = allStages.find(s => s.id === stageId);
      const stageName = stage?.name || `Stage ${stageId}`;

      // Enforce lifecycle state transition validation
      const targetState = mapStageToLifecycleState(stageId);
      if (targetState !== lifecycleState && !canExecuteInCurrentState(stageId, lifecycleState)) {
        // Invalid lifecycle transition - block execution and log
        addAuditEntry(createAuditEntry('GATE_BLOCKED', {
          stageId,
          stageName,
          stateFrom: lifecycleState,
          stateTo: targetState,
          reason: `Invalid lifecycle transition: ${lifecycleState} → ${targetState}. Complete prior stages first.`,
        }));
        return;
      }

      // Check if PHI gate is required for this stage using new PhiGate component modal
      // PHI-gated stages: 9, 13, 14, 17, 18, 19
      const continueAfterPhiGate = async () => {
        // This continuation runs after PHI gate passes or if stage is not PHI-gated
        await executeStageCore(stageId, stageName, targetState);
      };

      if (checkPhiGate(stageId, continueAfterPhiGate)) {
        // PHI gate modal opened - execution will continue via onPass callback
        return;
      }

      // Stage is not PHI-gated, continue with execution
      await executeStageCore(stageId, stageName, targetState);
    } finally {
      setExecutionPending(prev => ({ ...prev, [stageId]: false }));
    }
  };

  // Core stage execution logic (called after all gates pass)
  const executeStageCore = async (stageId: number, stageName: string, targetState: LifecycleState) => {
    // Check if AI approval is required for this stage (uses context-based modal)
    if (stageUsesAI(stageId)) {
      // Skip modal if already approved (e.g., phase-level or session-wide approval)
      if (!isStageAIApproved(stageId)) {
        const approvalResult = await requestAIApproval(stageId, stageName);
        if (!approvalResult.approved) {
          // AI approval was denied, log and return
          const aiTools = getAIToolsForStage(stageId);
          const primaryTool = aiTools[0];
          addAuditEntry(createAuditEntry('AI_CALL_BLOCKED', {
            stageId,
            stageName,
            reason: 'AI call denied by user',
            approvalMode: approvalResult.approvalMode,
            aiModel: primaryTool?.model,
            aiProvider: primaryTool?.provider,
            aiCostEstimate: primaryTool?.costEstimate,
          }));
          return;
        }
        // Log AI approval
        const aiTools = getAIToolsForStage(stageId);
        const primaryTool = aiTools[0];
        addAuditEntry(createAuditEntry('AI_CALL_APPROVED', {
          stageId,
          stageName,
          attestedBy: approvalResult.approvedBy,
          approvalMode: approvalResult.approvalMode,
          aiModel: primaryTool?.model,
          aiProvider: primaryTool?.provider,
          aiCostEstimate: primaryTool?.costEstimate,
          metadata: { approvedTools: approvalResult.approvedTools },
        }));
      }
      // Log AI execution (always log when AI stage is being executed)
      const aiTools = getAIToolsForStage(stageId);
      const primaryTool = aiTools[0];
      addAuditEntry(createAuditEntry('AI_CALL_EXECUTED', {
        stageId,
        stageName,
        aiModel: primaryTool?.model,
        aiProvider: primaryTool?.provider,
        aiCostEstimate: primaryTool?.costEstimate,
      }));
    }

    // Check if attestation gate is required for this stage
    if (checkAttestationRequired(stageId, stageName)) {
      // Attestation modal will be shown, execution will continue after confirmation
      return;
    }

    // Log stage execution to audit trail
    addAuditEntry(createAuditEntry('STAGE_EXECUTED', {
      stageId,
      stageName,
      reason: 'Direct execution (no attestation required)',
    }));

    // Update lifecycle state based on stage progression
    if (targetState !== lifecycleState && !requiresAttestation(targetState)) {
      transitionLifecycleState(targetState, `Stage ${stageId} executed`);
    }
    
    // Build request body based on stage requirements
    let body: Record<string, unknown> | undefined;
    const stage1Scope = scopeValuesByStage[1];
    const stage1Overview = overviewByStage[1] || "";
    const topicText = stage1Scope?.population
      ? `${stage1Scope.population} ${stage1Scope.outcomes ? `with outcomes: ${stage1Scope.outcomes}` : ''}`
      : stage1Overview || "Research topic to be defined";

    if (stageId === 1) {
      // Stage 1 (Topic Declaration): pass the research overview and PICO scope values
      body = {
        researchOverview: stage1Overview,
        population: stage1Scope?.population,
        intervention: stage1Scope?.intervention,
        comparator: stage1Scope?.comparator,
        outcomes: stage1Scope?.outcomes,
        timeframe: stage1Scope?.timeframe
      };
    } else if (stageId === 2) {
      // Stage 2 (Literature Search): pass the research topic from stage 1 scope values
      body = {
        topic: topicText,
        population: stage1Scope?.population,
        outcomes: stage1Scope?.outcomes
      };
    } else if (stageId === 4) {
      // Stage 4 (Planned Extraction): pass topic and literature data from stage 2
      const stage2Result = executionState[2]?.result;
      const literatureData = stage2Result?.literatureData as { keyInsights?: string[]; researchGaps?: string[] } | undefined;
      
      body = {
        topic: topicText,
        literatureSummary: literatureData?.keyInsights?.join(". ") || "",
        researchGaps: literatureData?.researchGaps || []
      };
    }
    
    executeMutation.mutate({ stageId, body });
  };

  const handleRunAll = async () => {
    if (!stageGroups) return;
    const allStages = stageGroups.flatMap(g => g.stages);
    const stage1Scope = scopeValuesByStage[1];
    const stage1OverviewText = overviewByStage[1] || "";
    const topicText = stage1Scope?.population
      ? `${stage1Scope.population} ${stage1Scope.outcomes ? `with outcomes: ${stage1Scope.outcomes}` : ''}`
      : stage1OverviewText || "Research topic to be defined";

    for (const stage of allStages) {
      if (executionState[stage.id]?.status !== 'completed') {
        await new Promise<void>((resolve) => {
          let body: Record<string, unknown> | undefined;

          if (stage.id === 1) {
            // Stage 1: pass research overview and PICO scope values
            body = {
              researchOverview: stage1OverviewText,
              population: stage1Scope?.population,
              intervention: stage1Scope?.intervention,
              comparator: stage1Scope?.comparator,
              outcomes: stage1Scope?.outcomes,
              timeframe: stage1Scope?.timeframe
            };
          } else if (stage.id === 2) {
            body = {
              topic: topicText,
              population: stage1Scope?.population,
              outcomes: stage1Scope?.outcomes
            };
          } else if (stage.id === 4) {
            const stage2Result = executionState[2]?.result;
            const literatureData = stage2Result?.literatureData as { keyInsights?: string[]; researchGaps?: string[] } | undefined;
            body = {
              topic: topicText,
              literatureSummary: literatureData?.keyInsights?.join(". ") || "",
              researchGaps: literatureData?.researchGaps || []
            };
          }

          executeMutation.mutate({ stageId: stage.id, body }, {
            onSettled: () => {
              setTimeout(resolve, 500);
            }
          });
        });
      }
    }
  };

  const handleDownloadBundle = async () => {
    if (isDownloadingBundle) return;
    
    setIsDownloadingBundle(true);
    try {
      const response = await fetch('/api/ros/export/reproducibility-bundle/DEMO-001?format=zip', {
        method: 'GET',
        headers: {
          'x-user-role': 'RESEARCHER'
        }
      });

      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'reproducibility-bundle-DEMO-001.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download bundle:', error);
    } finally {
      setIsDownloadingBundle(false);
    }
  };

  const handleReset = () => {
    setExecutionState({});
    setExpandedOutputs({});
    setSelectedManuscript(null);
    setSelectedJournal(null);
  };

  // Check if current stage is in Phase 2 (Data Processing & Validation) - stages 5-8
  const isPhase2Stage = (stageId: number) => stageId >= 5 && stageId <= 8;

  // File upload handlers
  const formatFileSize = (bytes: number) => formatBytes(bytes, 1);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const clearUploadTimeouts = () => {
    uploadTimeoutsRef.current.forEach(id => clearTimeout(id));
    uploadTimeoutsRef.current = [];
  };

  const handleFileUpload = (file: File) => {
    // Clear any existing timeouts
    clearUploadTimeouts();
    
    // Simulate upload with demo data
    setUploadedFile({
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date(),
      status: 'uploading'
    });

    // Simulate upload progress and validation with tracked timeouts
    const timeout1 = window.setTimeout(() => {
      setUploadedFile(prev => prev ? {
        ...prev,
        status: 'uploaded'
      } : null);
    }, 800);

    const timeout2 = window.setTimeout(() => {
      // Generate simulated dataset statistics
      const isCSV = file.name.endsWith('.csv');
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      setUploadedFile(prev => prev ? {
        ...prev,
        status: 'validated',
        recordCount: Math.floor(Math.random() * 2000) + 500,
        variableCount: isCSV || isExcel ? Math.floor(Math.random() * 30) + 15 : undefined
      } : null);
    }, 1500);

    uploadTimeoutsRef.current = [timeout1, timeout2];
  };

  const handleRemoveFile = () => {
    clearUploadTimeouts();
    setUploadedFile(null);
  };

  const getStageStatus = (stage: WorkflowStage) => {
    const execState = executionState[stage.id];
    if (execState?.status === 'completed') return 'completed';
    if (execState?.status === 'executing') return 'active';
    return 'pending';
  };

  const getStageStatusIcon = (stage: WorkflowStage) => {
    const status = getStageStatus(stage);
    switch (status) {
      case 'completed': 
        return <Check className="h-4 w-4 text-ros-success" />;
      case 'active': 
        return <Loader2 className="h-4 w-4 text-ros-workflow animate-spin" />;
      default: 
        return <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />;
    }
  };

  const getGroupStatusBadge = (status: string, isOptional: boolean) => {
    if (isOptional) {
      return <Badge variant="outline" className="text-muted-foreground" data-testid="badge-optional">Optional</Badge>;
    }
    switch (status) {
      case 'completed': 
        return <Badge className="bg-ros-success/10 text-ros-success border-ros-success/20" data-testid="badge-group-completed">Complete</Badge>;
      case 'active': 
        return <Badge className="bg-ros-workflow/10 text-ros-workflow border-ros-workflow/20" data-testid="badge-group-active">In Progress</Badge>;
      default: 
        return <Badge variant="secondary" data-testid="badge-group-pending">Pending</Badge>;
    }
  };

  const canExecuteStage = (stageId: number) => {
    if (!stageGroups) return false;
    const allStages = stageGroups.flatMap(g => g.stages);
    const stageIndex = allStages.findIndex(s => s.id === stageId);
    
    // Check lifecycle state enforcement - validate state transition is allowed
    if (!canExecuteInCurrentState(stageId, lifecycleState)) {
      // If not in same state and no valid transition, block execution
      const targetState = mapStageToLifecycleState(stageId);
      if (targetState !== lifecycleState && !isValidTransition(lifecycleState, targetState)) {
        return false;
      }
    }
    
    if (stageIndex === 0) return true;
    
    const previousStage = allStages[stageIndex - 1];
    const previousCompleted = executionState[previousStage.id]?.status === 'completed';
    
    // Stage 12 (Manuscript Selection) requires a manuscript to be selected from Stage 11
    if (stageId === 12 && !selectedManuscript) {
      return false;
    }
    
    // Stages 17-19 (Conference Readiness) require a journal to be selected from Stage 16
    if (stageId >= 17 && stageId <= 19 && !selectedJournal) {
      return false;
    }
    
    return previousCompleted;
  };

  const toggleOutputExpand = (outputKey: string) => {
    setExpandedOutputs(prev => ({
      ...prev,
      [outputKey]: !prev[outputKey]
    }));
  };

  if (isLoading) {
    return (
      <section className="py-16 lg:py-24 bg-gradient-to-b from-background via-muted/30 to-background" data-testid="section-workflow-loading">
        <div className="container mx-auto px-6 lg:px-24">
          <div className="text-center mb-12">
            <Skeleton className="h-8 w-32 mx-auto mb-4" />
            <Skeleton className="h-12 w-96 mx-auto mb-4" />
            <Skeleton className="h-6 w-2/3 mx-auto" />
          </div>
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!stageGroups) return null;

  const totalStages = stageGroups.reduce((acc, g) => acc + g.stages.length, 0);
  const completedStages = Object.values(executionState).filter(s => s.status === 'completed').length;
  const executingStages = Object.values(executionState).filter(s => s.status === 'executing').length;
  
  // AI calls counter - count approved and pending AI stages
  const allStagesList = stageGroups.flatMap(g => g.stages);
  const aiStages = allStagesList.filter(s => stageUsesAI(s.id));
  const aiApprovedCount = auditLog.filter(e => e.action === 'AI_CALL_APPROVED').length;
  const aiExecutedCount = auditLog.filter(e => e.action === 'AI_CALL_EXECUTED').length;
  const aiPendingCount = aiStages.length - aiExecutedCount;

  const sidebarPhases: PhaseGroupInfo[] = stageGroups.map((group) => ({
    id: group.id,
    name: group.name,
    shortName: group.shortName,
    isOptional: group.isOptional,
    stages: group.stages.map((stage): WorkflowStageInfo => ({
      id: stage.id,
      name: stage.name,
      shortName: stage.shortName,
      status: executionState[stage.id]?.status === 'completed'
        ? 'completed'
        : executionState[stage.id]?.status === 'executing'
          ? 'active'
          : 'pending',
    })),
  }));

  const mockDataset = {
    id: 'thyroid-001',
    name: 'Thyroid Study Dataset',
    type: 'Clinical Registry',
    records: 2847,
    variables: 42,
    dateRange: '2018-2024',
    phiStatus: 'De-identified' as const,
  };

  const handleSidebarStageSelect = (stageId: number) => {
    const stage = allStagesList.find(s => s.id === stageId);
    if (stage) {
      setSelectedStage(stage);
    }
  };

  return (
    <>
      <WorkflowSidebar
        phases={sidebarPhases}
        currentStageId={selectedStage?.id}
        dataset={mockDataset}
        onStageSelect={handleSidebarStageSelect}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <section className="py-16 lg:py-24 bg-gradient-to-b from-background via-muted/30 to-background overflow-hidden" data-testid="section-workflow">
      <div className="container mx-auto px-6 lg:px-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 lg:mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground mb-4" data-testid="text-workflow-heading">
            Execute the Full Research Pipeline
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6" data-testid="text-workflow-description">
            Run each stage to see real outputs. {totalStages} automated stages take your data from initial upload through to a publication-ready manuscript.
          </p>
          
          <div className="flex items-center justify-center gap-4 flex-wrap mb-4">
            <div className="flex items-center gap-2 text-sm">
              <div className="h-3 w-3 rounded-full bg-ros-success" />
              <span className="text-muted-foreground">{completedStages} completed</span>
            </div>
            {executingStages > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <div className="h-3 w-3 rounded-full bg-ros-workflow animate-pulse" />
                <span className="text-muted-foreground">{executingStages} running</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <div className="h-3 w-3 rounded-full bg-muted" />
              <span className="text-muted-foreground">{totalStages - completedStages} pending</span>
            </div>
          </div>

          {/* Governance Lifecycle State Indicator */}
          <div className="flex items-center justify-center gap-3 mb-6 flex-wrap" data-testid="governance-lifecycle-indicator">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50">
              <div className={`w-2 h-2 rounded-full ${
                isImmutable(lifecycleState) ? 'bg-blue-500' :
                lifecycleState === 'IN_ANALYSIS' ? 'bg-ros-workflow animate-pulse' :
                lifecycleState === 'QA_FAILED' ? 'bg-ros-alert' :
                'bg-ros-success'
              }`} />
              <span className="text-sm font-medium">
                Lifecycle: <span className={STATE_METADATA[lifecycleState].color}>{STATE_METADATA[lifecycleState].label}</span>
              </span>
              {isImmutable(lifecycleState) && <Lock className="h-3 w-3 text-blue-500" />}
            </div>
            
            {/* AI Calls Counter */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-ros-workflow/10 border border-ros-workflow/20" data-testid="ai-calls-counter">
              <Bot className="h-4 w-4 text-ros-workflow" />
              <span className="text-sm font-medium">
                AI Calls: <span className="text-ros-success">{aiApprovedCount} approved</span>
                {aiPendingCount > 0 && (
                  <>, <span className="text-muted-foreground">{aiPendingCount} pending</span></>
                )}
              </span>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAuditTrail(!showAuditTrail)}
              className="gap-1.5"
              data-testid="button-toggle-audit-trail"
            >
              <History className="h-4 w-4" />
              Audit Trail ({auditLog.length})
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetProgress}
              className="gap-1.5 text-ros-alert hover:bg-ros-alert/10 border-ros-alert/30"
              data-testid="button-reset-progress"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Progress
            </Button>
          </div>

          {/* Audit Trail Collapsible Panel */}
          <AnimatePresence>
            {showAuditTrail && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 overflow-hidden"
              >
                <Card className="p-4 max-w-2xl mx-auto" data-testid="card-audit-trail">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-ros-workflow" />
                      Governance Audit Trail
                    </h4>
                    <Badge variant="secondary" className="text-xs">
                      {auditLog.length} entries
                    </Badge>
                  </div>
                  {auditLog.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No governance events recorded yet.</p>
                      <p className="text-xs mt-1">Events will appear as you progress through the workflow.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {auditLog.slice(0, 10).map((entry) => (
                        <div 
                          key={entry.id} 
                          className="flex items-start gap-3 p-2 rounded-md bg-muted/30 text-sm"
                          data-testid={`audit-entry-${entry.id}`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                            entry.action === 'STATE_CHANGE' ? 'bg-ros-workflow' :
                            entry.action === 'ATTESTATION_PROVIDED' ? 'bg-ros-success' :
                            entry.action === 'GATE_BLOCKED' ? 'bg-ros-alert' :
                            'bg-ros-primary'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="secondary" className="text-xs">
                                {entry.action.replace(/_/g, ' ')}
                              </Badge>
                              {entry.stateFrom && entry.stateTo && (
                                <span className="text-xs text-muted-foreground">
                                  {entry.stateFrom} → {entry.stateTo}
                                </span>
                              )}
                              {entry.stageName && (
                                <span className="text-xs text-muted-foreground">
                                  {entry.stageName}
                                </span>
                              )}
                            </div>
                            {entry.attestedBy && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Attested by: {entry.attestedBy}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {new Date(entry.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-center gap-3">
            <Button 
              onClick={handleRunAll}
              disabled={executeMutation.isPending || completedStages === totalStages}
              className="bg-ros-workflow"
              data-testid="button-run-all"
            >
              <Play className="h-4 w-4 mr-2" />
              Run All Stages
            </Button>
            <Button 
              variant="outline" 
              onClick={handleReset}
              disabled={completedStages === 0}
              data-testid="button-reset"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <Accordion 
              type="multiple" 
              value={expandedGroups}
              onValueChange={setExpandedGroups}
              className="space-y-4"
              data-testid="accordion-workflow-groups"
            >
              {stageGroups.map((group, groupIndex) => {
                const GroupIcon = iconMap[group.icon] || FileStack;
                const groupStatus = getGroupStatus(group.stages, executionState);
                const progress = getGroupProgress(group.stages, executionState);
                
                return (
                  <motion.div
                    key={group.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: groupIndex * 0.1 }}
                  >
                    <AccordionItem 
                      value={group.id} 
                      className="border rounded-xl overflow-hidden bg-card"
                      data-testid={`accordion-group-${group.id}`}
                    >
                      <AccordionTrigger 
                        className="px-4 py-3 hover:no-underline hover:bg-muted/50 [&[data-state=open]]:bg-muted/30"
                        data-testid={`button-group-${group.id}`}
                      >
                        <div className="flex items-center gap-3 flex-1 text-left">
                          <div className={`
                            w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                            ${groupStatus === 'completed' ? 'bg-ros-success/10 text-ros-success' : ''}
                            ${groupStatus === 'active' ? 'bg-ros-workflow/10 text-ros-workflow' : ''}
                            ${groupStatus === 'pending' ? 'bg-muted text-muted-foreground' : ''}
                            ${group.isOptional ? 'border-2 border-dashed border-muted-foreground/30' : ''}
                          `}>
                            {groupStatus === 'completed' ? (
                              <Check className="h-5 w-5" />
                            ) : (
                              <GroupIcon className="h-5 w-5" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-medium text-muted-foreground">
                                Phase {groupIndex + 1}
                              </span>
                              {getGroupStatusBadge(groupStatus, group.isOptional)}
                            </div>
                            <h3 className="font-semibold text-sm" data-testid={`text-group-name-${group.id}`}>
                              {group.name}
                            </h3>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-muted-foreground">{progress}%</span>
                          </div>
                        </div>
                      </AccordionTrigger>
                      
                      <AccordionContent className="px-4 pb-3">
                        <div className="space-y-1 pt-1">
                          {group.stages.map((stage) => {
                            const StageIcon = iconMap[stage.icon] || FileText;
                            const isSelected = selectedStage?.id === stage.id;
                            const stageStatus = getStageStatus(stage);
                            
                            return (
                              <motion.button
                                key={stage.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                onClick={() => setSelectedStage(stage)}
                                className={`
                                  w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left
                                  ${isSelected ? 'bg-ros-primary/5 ring-2 ring-ros-primary/20' : 'hover:bg-muted/50'}
                                  ${stageStatus === 'active' ? 'bg-ros-workflow/5' : ''}
                                `}
                                data-testid={`button-stage-${stage.id}`}
                              >
                                <div className="flex items-center justify-center w-6">
                                  {getStageStatusIcon(stage)}
                                </div>
                                
                                <div className={`
                                  w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0
                                  ${stageStatus === 'completed' ? 'bg-ros-success/10 text-ros-success' : ''}
                                  ${stageStatus === 'active' ? 'bg-ros-workflow/10 text-ros-workflow' : ''}
                                  ${stageStatus === 'pending' ? 'bg-muted text-muted-foreground' : ''}
                                `}>
                                  <StageIcon className="h-4 w-4" />
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-sm truncate" data-testid={`text-stage-name-${stage.id}`}>
                                      {stage.shortName}
                                    </span>
                                    {stageUsesAI(stage.id) && (
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-ros-workflow/10 text-ros-workflow border-ros-workflow/20" data-testid={`badge-ai-stage-${stage.id}`}>
                                        <Bot className="h-2.5 w-2.5 mr-0.5" />
                                        AI
                                      </Badge>
                                    )}
                                    {stageRequiresAttestation(stage.id) && (
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-ros-alert/10 text-ros-alert border-ros-alert/20" data-testid={`badge-attestation-stage-${stage.id}`}>
                                        <ShieldCheck className="h-2.5 w-2.5 mr-0.5" />
                                        Gate
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                
                                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              </motion.button>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </motion.div>
                );
              })}
            </Accordion>
          </div>

          <div className="lg:col-span-3">
            <div className="sticky top-24 z-[100]">
              <AnimatePresence mode="wait">
                {selectedStage ? (
                  <motion.div
                    key={selectedStage.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className="p-6 border-border/50 max-h-[75vh] overflow-y-auto" data-testid="card-stage-details">
                        <div className="space-y-6">
                          <div>
                            <div className="flex items-center gap-3 mb-3">
                              {(() => {
                                const IconComponent = iconMap[selectedStage.icon] || FileText;
                                const stageStatus = getStageStatus(selectedStage);
                                return (
                                  <div className={`
                                    w-12 h-12 rounded-xl flex items-center justify-center
                                    ${stageStatus === 'completed' ? 'bg-ros-success/10 text-ros-success' : ''}
                                    ${stageStatus === 'active' ? 'bg-ros-workflow/10 text-ros-workflow' : ''}
                                    ${stageStatus === 'pending' ? 'bg-muted text-muted-foreground' : ''}
                                  `}>
                                    <IconComponent className="h-6 w-6" />
                                  </div>
                                );
                              })()}
                              <div className="flex-1">
                                <Badge 
                                  className={`mb-1 ${
                                    getStageStatus(selectedStage) === 'completed' ? 'bg-ros-success/10 text-ros-success border-ros-success/20' :
                                    getStageStatus(selectedStage) === 'active' ? 'bg-ros-workflow/10 text-ros-workflow border-ros-workflow/20' :
                                    ''
                                  }`}
                                  variant={getStageStatus(selectedStage) === 'pending' ? 'secondary' : 'default'}
                                  data-testid="badge-stage-status"
                                >
                                  {getStageStatus(selectedStage) === 'completed' ? 'Completed' : 
                                   getStageStatus(selectedStage) === 'active' ? 'Executing...' : 'Ready'}
                                </Badge>
                              </div>
                              
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleExecuteStage(selectedStage.id)}
                                  disabled={
                                    executionPending[selectedStage.id] ||
                                    executionState[selectedStage.id]?.status === 'executing' ||
                                    executionState[selectedStage.id]?.status === 'completed' ||
                                    !canExecuteStage(selectedStage.id)
                                  }
                                  className="bg-ros-primary"
                                  data-testid="button-execute-stage"
                                >
                                  {executionState[selectedStage.id]?.status === 'executing' ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Running...
                                    </>
                                  ) : executionState[selectedStage.id]?.status === 'completed' ? (
                                    <>
                                      <Check className="h-4 w-4 mr-2" />
                                      Completed
                                    </>
                                  ) : (
                                    <>
                                      <Play className="h-4 w-4 mr-2" />
                                      Execute
                                    </>
                                  )}
                                </Button>
                                
                                {executionState[selectedStage.id]?.status === 'completed' && (
                                  <Button
                                    onClick={handleDownloadBundle}
                                    disabled={isDownloadingBundle}
                                    variant="outline"
                                    data-testid="button-download-bundle"
                                  >
                                    {isDownloadingBundle ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Downloading...
                                      </>
                                    ) : (
                                      <>
                                        <Download className="h-4 w-4 mr-2" />
                                        Download Bundle
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                            
                            <h3 className="text-xl font-semibold mb-2" data-testid="text-stage-name">
                              {selectedStage.name}
                            </h3>
                            <p className="text-muted-foreground" data-testid="text-stage-description">
                              {selectedStage.description}
                            </p>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-sm" data-testid="text-stage-duration">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Est. time:</span>
                              <span className="font-medium">{selectedStage.duration}</span>
                            </div>
                            {executionState[selectedStage.id]?.result?.executionTime && (
                              <div className="flex items-center gap-2 text-sm">
                                <CheckCircle className="h-4 w-4 text-ros-success" />
                                <span className="text-ros-success font-medium">
                                  {executionState[selectedStage.id]?.result?.executionTime}
                                </span>
                              </div>
                            )}
                          </div>

                          {selectedStage.dependencies && selectedStage.dependencies.length > 0 && (
                            <div className="p-4 rounded-lg bg-ros-primary/5 border border-ros-primary/20" data-testid="section-dependencies">
                              <div className="flex items-center gap-2 mb-3">
                                <Link2 className="h-4 w-4 text-ros-primary" />
                                <h4 className="font-medium text-sm text-ros-primary">Uses Data From:</h4>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {selectedStage.dependencies.map((dep, index) => (
                                  <Badge 
                                    key={index}
                                    variant="outline"
                                    className="px-3 py-1.5 border-ros-primary/30 text-ros-primary"
                                    data-testid={`badge-dependency-${index}`}
                                  >
                                    {dep}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Topic Brief Panel for Stage 1 (Topic Declaration) - shows after completion */}
                          {selectedStage.id === 1 && executionState[1]?.status === 'completed' && (
                            <TopicBriefPanel 
                              scopeValues={scopeValuesByStage[1] || {}}
                              onExport={(format) => console.log(`Exported topic brief as ${format}`)}
                            />
                          )}

                          {/* AI Research Brief Panel for Stage 1 (Topic Declaration) */}
                          {selectedStage.id === 1 && (
                            <AIResearchBriefPanel 
                              topicVersion={topicVersionHistory.currentVersion || 1}
                              topicData={scopeValuesByStage[1] as { population?: string; intervention?: string; comparator?: string; outcomes?: string; timeframe?: string }}
                            />
                          )}

                          {/* IRB Panel for Stage 3 (IRB Proposal) */}
                          {selectedStage.id === 3 && (
                            <IrbPanel 
                              researchQuestion={scopeValuesByStage[1]?.population || ""}
                              studyTitle="Research Study"
                            />
                          )}

                          {/* Summary Charts for Stage 9 (Summary Characteristics) */}
                          {selectedStage.id === 9 && executionState[9]?.status === 'completed' && (
                            <>
                              <SummaryChartsSection
                                ageDistribution={[
                                  { bin: "18-29", count: 234 },
                                  { bin: "30-39", count: 456 },
                                  { bin: "40-49", count: 612 },
                                  { bin: "50-59", count: 789 },
                                  { bin: "60-69", count: 534 },
                                  { bin: "70+", count: 222 },
                                ]}
                                boxPlotData={[
                                  { category: "Euthyroid", min: 0.4, q1: 1.2, median: 2.1, q3: 3.4, max: 4.9 },
                                  { category: "Subclinical", min: 4.5, q1: 5.8, median: 6.4, q3: 8.2, max: 12.1 },
                                ]}
                                correlationData={[
                                  { variable1: "TSH", variable2: "TSH", correlation: 1.0 },
                                  { variable1: "TSH", variable2: "Age", correlation: 0.32 },
                                  { variable1: "TSH", variable2: "BMI", correlation: 0.18 },
                                  { variable1: "Age", variable2: "TSH", correlation: 0.32 },
                                  { variable1: "Age", variable2: "Age", correlation: 1.0 },
                                  { variable1: "Age", variable2: "BMI", correlation: 0.24 },
                                  { variable1: "BMI", variable2: "TSH", correlation: 0.18 },
                                  { variable1: "BMI", variable2: "Age", correlation: 0.24 },
                                  { variable1: "BMI", variable2: "BMI", correlation: 1.0 },
                                ]}
                                correlationVariables={["TSH", "Age", "BMI"]}
                              />
                              {/* Fairness Metrics - Bias Detection */}
                              <FairnessMetrics
                                totalRecords={2847}
                                ageGroups={[
                                  { name: "18-29", count: 234, percentage: 8.2 },
                                  { name: "30-39", count: 456, percentage: 16.0 },
                                  { name: "40-49", count: 612, percentage: 21.5 },
                                  { name: "50-59", count: 789, percentage: 27.7 },
                                  { name: "60-69", count: 534, percentage: 18.8 },
                                  { name: "70+", count: 222, percentage: 7.8 },
                                ]}
                                genderDistribution={[
                                  { name: "Female", count: 1847, percentage: 64.9 },
                                  { name: "Male", count: 1000, percentage: 35.1 },
                                ]}
                                geographicRegions={[
                                  { name: "Northeast", count: 854, percentage: 30.0 },
                                  { name: "Southeast", count: 712, percentage: 25.0 },
                                  { name: "Midwest", count: 569, percentage: 20.0 },
                                  { name: "Southwest", count: 427, percentage: 15.0 },
                                  { name: "Northwest", count: 285, percentage: 10.0 },
                                ]}
                                ethnicityGroups={[
                                  { name: "Caucasian", count: 1708, percentage: 60.0 },
                                  { name: "Hispanic", count: 427, percentage: 15.0 },
                                  { name: "African American", count: 399, percentage: 14.0 },
                                  { name: "Asian", count: 228, percentage: 8.0 },
                                  { name: "Other", count: 85, percentage: 3.0 },
                                ]}
                              />
                            </>
                          )}

                          {/* SAP Builder for Stage 13 (Statistical Analysis) */}
                          {selectedStage.id === 13 && (
                            <SapBuilderPanel />
                          )}

                          {/* Conference Readiness for Stages 17-19 */}
                          {(selectedStage.id === 17 || selectedStage.id === 18 || selectedStage.id === 19) && (
                            <ConferenceReadinessPanel stageId={selectedStage.id as 17 | 18 | 19} />
                          )}

                          {/* Data Upload Section for Phase 2 */}
                          {isPhase2Stage(selectedStage.id) && (
                            <div className="space-y-4" data-testid="section-data-upload">
                              <div className="flex items-center gap-2">
                                <HardDrive className="h-5 w-5 text-ros-primary" />
                                <h4 className="font-medium">Research Data</h4>
                              </div>
                              
                              {!uploadedFile ? (
                                <div
                                  className={`
                                    relative border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer
                                    ${isDragOver 
                                      ? 'border-ros-primary bg-ros-primary/5' 
                                      : 'border-border hover:border-ros-primary/50 hover:bg-muted/50'}
                                  `}
                                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                                  onDragLeave={() => setIsDragOver(false)}
                                  onDrop={handleFileDrop}
                                  onClick={() => document.getElementById('file-upload')?.click()}
                                  data-testid="dropzone-upload"
                                >
                                  <input
                                    type="file"
                                    id="file-upload"
                                    className="hidden"
                                    accept=".csv,.xlsx,.xls,.json,.txt,.sav,.dta"
                                    onChange={handleFileSelect}
                                    data-testid="input-file-upload"
                                  />
                                  <div className="flex flex-col items-center gap-3">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                      isDragOver ? 'bg-ros-primary/10' : 'bg-muted'
                                    }`}>
                                      <Upload className={`h-6 w-6 ${isDragOver ? 'text-ros-primary' : 'text-muted-foreground'}`} />
                                    </div>
                                    <div>
                                      <p className="font-medium text-sm">
                                        {isDragOver ? 'Drop your file here' : 'Upload your research data'}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Drag & drop or click to browse
                                      </p>
                                    </div>
                                    <div className="flex flex-wrap justify-center gap-1 mt-2">
                                      {['.csv', '.xlsx', '.json', '.sav', '.dta'].map(ext => (
                                        <Badge key={ext} variant="secondary" className="text-xs">
                                          {ext}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="border rounded-lg overflow-hidden" data-testid="section-uploaded-file">
                                  <div className="p-4 bg-muted/30">
                                    <div className="flex items-start gap-3">
                                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                        uploadedFile.status === 'validated' ? 'bg-ros-success/10' :
                                        uploadedFile.status === 'uploading' ? 'bg-ros-workflow/10' : 'bg-muted'
                                      }`}>
                                        {uploadedFile.status === 'uploading' ? (
                                          <Loader2 className="h-5 w-5 text-ros-workflow animate-spin" />
                                        ) : uploadedFile.status === 'validated' ? (
                                          <CheckCircle className="h-5 w-5 text-ros-success" />
                                        ) : (
                                          <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <p className="font-medium text-sm truncate" data-testid="text-file-name">
                                            {uploadedFile.name}
                                          </p>
                                          {uploadedFile.status === 'validated' && (
                                            <Badge className="bg-ros-success/10 text-ros-success border-ros-success/20">
                                              <Check className="h-3 w-3 mr-1" />
                                              Validated
                                            </Badge>
                                          )}
                                          {uploadedFile.status === 'uploading' && (
                                            <Badge className="bg-ros-workflow/10 text-ros-workflow border-ros-workflow/20">
                                              Uploading...
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5" data-testid="text-file-size">
                                          {formatFileSize(uploadedFile.size)}
                                        </p>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        onClick={handleRemoveFile}
                                        data-testid="button-remove-file"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                    
                                    {uploadedFile.status === 'validated' && (
                                      <div className="mt-4 pt-4 border-t border-border/50">
                                        <div className="grid grid-cols-2 gap-4">
                                          <div className="flex items-center gap-2 p-2 rounded-md bg-background">
                                            <Database className="h-4 w-4 text-ros-primary" />
                                            <div>
                                              <p className="text-xs text-muted-foreground">Records</p>
                                              <p className="font-semibold text-sm" data-testid="text-record-count">
                                                {uploadedFile.recordCount?.toLocaleString()}
                                              </p>
                                            </div>
                                          </div>
                                          {uploadedFile.variableCount && (
                                            <div className="flex items-center gap-2 p-2 rounded-md bg-background">
                                              <TableProperties className="h-4 w-4 text-ros-primary" />
                                              <div>
                                                <p className="text-xs text-muted-foreground">Variables</p>
                                                <p className="font-semibold text-sm" data-testid="text-variable-count">
                                                  {uploadedFile.variableCount}
                                                </p>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                        <div className="mt-3 p-2 rounded-md bg-ros-success/5 border border-ros-success/20">
                                          <p className="text-xs text-ros-success flex items-center gap-1.5">
                                            <ShieldCheck className="h-3.5 w-3.5" />
                                            Dataset ready for PHI scanning and processing
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              {!uploadedFile && (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                                  <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                                  <p className="text-xs text-amber-600 dark:text-amber-400">
                                    Upload your research dataset to enable data processing stages
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {executionState[selectedStage.id]?.status === 'executing' && (
                            <div className="p-4 rounded-lg bg-ros-workflow/5 border border-ros-workflow/20" data-testid="progress-active-stage">
                              <div className="flex items-center gap-3 mb-3">
                                <Loader2 className="h-5 w-5 text-ros-workflow animate-spin" />
                                <span className="font-medium text-ros-workflow">Executing stage...</span>
                              </div>
                              <div className="h-2 bg-ros-workflow/20 rounded-full overflow-hidden">
                                <motion.div 
                                  className="h-full bg-ros-workflow rounded-full"
                                  initial={{ width: "0%" }}
                                  animate={{ width: "100%" }}
                                  transition={{ duration: 2, repeat: Infinity }}
                                />
                              </div>
                            </div>
                          )}

                          {executionState[selectedStage.id]?.status === 'completed' && executionState[selectedStage.id]?.result && (
                            <div className="space-y-4" data-testid="section-execution-results">
                              <div className={`p-4 rounded-lg ${executionState[selectedStage.id]?.result?.aiPowered ? 'bg-gradient-to-r from-ros-success/5 to-ros-workflow/5 border-ros-workflow/30' : 'bg-ros-success/5'} border border-ros-success/20`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <CheckCircle className="h-5 w-5 text-ros-success" />
                                  <h4 className="font-medium text-ros-success">Execution Complete</h4>
                                  {executionState[selectedStage.id]?.result?.aiPowered && (
                                    <Badge className="bg-gradient-to-r from-ros-workflow to-purple-500 text-white border-0 ml-2" data-testid="badge-ai-powered">
                                      <Sparkles className="h-3 w-3 mr-1" />
                                      AI-Powered
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {executionState[selectedStage.id]?.result?.summary}
                                </p>
                              </div>

                              <div>
                                <h4 className="font-medium mb-3 flex items-center gap-2">
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                  Generated Outputs
                                  {stageRequiresPhiGate(selectedStage.id) && (
                                    <PhiStatusBadge status={phiStatus} size="sm" showLabel={true} />
                                  )}
                                </h4>
                                <div className="space-y-3">
                                  {executionState[selectedStage.id]?.result?.outputs.map((output, index) => {
                                    const outputKey = `${selectedStage.id}-${index}`;
                                    const isExpanded = expandedOutputs[outputKey];
                                    const OutputIcon = outputTypeIcons[output.type] || FileText;
                                    
                                    return (
                                      <div 
                                        key={index}
                                        className="border rounded-lg overflow-hidden"
                                        data-testid={`output-${index}`}
                                      >
                                        <button
                                          onClick={() => toggleOutputExpand(outputKey)}
                                          className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                                          data-testid={`button-toggle-output-${index}`}
                                        >
                                          <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                                            <OutputIcon className="h-4 w-4 text-muted-foreground" />
                                          </div>
                                          <div className="flex-1">
                                            <div className="font-medium text-sm">{output.title}</div>
                                            <div className="text-xs text-muted-foreground capitalize">{output.type}</div>
                                          </div>
                                          {isExpanded ? (
                                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                          ) : (
                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                          )}
                                        </button>
                                        
                                        <AnimatePresence>
                                          {isExpanded && (
                                            <motion.div
                                              initial={{ height: 0, opacity: 0 }}
                                              animate={{ height: "auto", opacity: 1 }}
                                              exit={{ height: 0, opacity: 0 }}
                                              transition={{ duration: 0.2 }}
                                              className="border-t"
                                            >
                                              <div className="p-4 bg-muted/30">
                                                <pre className="text-sm whitespace-pre-wrap font-mono text-muted-foreground leading-relaxed">
                                                  {output.content}
                                                </pre>
                                              </div>
                                            </motion.div>
                                          )}
                                        </AnimatePresence>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Manuscript Proposal Selection for Stage 11 */}
                              {selectedStage.id === 11 && executionState[11]?.result?.manuscriptProposals && (
                                <div className="space-y-4 mt-4" data-testid="section-manuscript-proposals">
                                  <div className="flex items-center gap-2">
                                    <Lightbulb className="h-5 w-5 text-ros-workflow" />
                                    <h4 className="font-medium">Select a Manuscript to Develop</h4>
                                  </div>
                                  
                                  <div className="space-y-3">
                                    {executionState[11]?.result?.manuscriptProposals.map((proposal) => (
                                      <motion.button
                                        key={proposal.id}
                                        onClick={() => setSelectedManuscript({
                                          id: proposal.id,
                                          title: proposal.title,
                                          relevance: proposal.relevance,
                                          novelty: proposal.novelty,
                                          feasibility: proposal.feasibility,
                                          targetJournals: proposal.targetJournals
                                        })}
                                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                                          selectedManuscript?.id === proposal.id
                                            ? 'border-ros-workflow bg-ros-workflow/5'
                                            : 'border-border hover:border-ros-workflow/50 hover:bg-muted/50'
                                        }`}
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        data-testid={`button-select-proposal-${proposal.id}`}
                                      >
                                        <div className="flex items-start gap-3">
                                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                            selectedManuscript?.id === proposal.id
                                              ? 'bg-ros-workflow text-white'
                                              : 'bg-muted text-muted-foreground'
                                          }`}>
                                            {selectedManuscript?.id === proposal.id ? (
                                              <Check className="h-5 w-5" />
                                            ) : (
                                              <span className="font-semibold">{proposal.id}</span>
                                            )}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                              <h5 className="font-medium text-sm line-clamp-1" data-testid={`text-proposal-title-${proposal.id}`}>
                                                {proposal.title}
                                              </h5>
                                              {selectedManuscript?.id === proposal.id && (
                                                <Badge className="bg-ros-workflow text-white border-0 text-xs">
                                                  Selected
                                                </Badge>
                                              )}
                                            </div>
                                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                              {proposal.description}
                                            </p>
                                            <div className="flex flex-wrap gap-3 text-xs">
                                              <div className="flex items-center gap-1">
                                                <span className="text-muted-foreground">Relevance:</span>
                                                <span className="font-medium text-ros-success">{proposal.relevance}/100</span>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <span className="text-muted-foreground">Novelty:</span>
                                                <span className="font-medium text-ros-workflow">{proposal.novelty}/100</span>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <span className="text-muted-foreground">Feasibility:</span>
                                                <span className="font-medium text-ros-primary">{proposal.feasibility}/100</span>
                                              </div>
                                            </div>
                                            <div className="flex flex-wrap gap-1 mt-2">
                                              {proposal.targetJournals.slice(0, 2).map((journal, idx) => (
                                                <Badge key={idx} variant="secondary" className="text-xs">
                                                  {journal}
                                                </Badge>
                                              ))}
                                              {proposal.targetJournals.length > 2 && (
                                                <Badge variant="secondary" className="text-xs">
                                                  +{proposal.targetJournals.length - 2} more
                                                </Badge>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </motion.button>
                                    ))}
                                  </div>

                                  {selectedManuscript && (
                                    <div className="p-3 rounded-lg bg-ros-workflow/5 border border-ros-workflow/20">
                                      <div className="flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4 text-ros-workflow" />
                                        <p className="text-sm text-ros-workflow font-medium">
                                          Selected: {selectedManuscript.title}
                                        </p>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Proceed to Manuscript Selection stage to begin development
                                      </p>
                                    </div>
                                  )}

                                  {!selectedManuscript && (
                                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                                      <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                                      <p className="text-xs text-amber-600 dark:text-amber-400">
                                        Select a manuscript proposal to continue with development
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Journal Recommendation Selection for Stage 16 */}
                              {selectedStage.id === 16 && executionState[16]?.result?.journalRecommendations && (
                                <div className="space-y-4 mt-4" data-testid="section-journal-recommendations">
                                  <div className="flex items-center gap-2">
                                    <Send className="h-5 w-5 text-ros-workflow" />
                                    <h4 className="font-medium">Select a Journal for Submission</h4>
                                  </div>
                                  
                                  <div className="space-y-3">
                                    {executionState[16]?.result?.journalRecommendations.map((journal) => (
                                      <motion.button
                                        key={journal.id}
                                        onClick={() => setSelectedJournal({
                                          id: journal.id,
                                          name: journal.name,
                                          impactFactor: journal.impactFactor,
                                          acceptanceRate: journal.acceptanceRate,
                                          reviewTime: journal.reviewTime,
                                          strengths: journal.strengths,
                                          weaknesses: journal.weaknesses,
                                          fitScore: journal.fitScore,
                                          openAccess: journal.openAccess,
                                          publicationFee: journal.publicationFee
                                        })}
                                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                                          selectedJournal?.id === journal.id
                                            ? 'border-ros-workflow bg-ros-workflow/5'
                                            : 'border-border hover:border-ros-workflow/50 hover:bg-muted/50'
                                        }`}
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        data-testid={`button-select-journal-${journal.id}`}
                                      >
                                        <div className="flex items-start gap-3">
                                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                            selectedJournal?.id === journal.id
                                              ? 'bg-ros-workflow text-white'
                                              : 'bg-muted text-muted-foreground'
                                          }`}>
                                            {selectedJournal?.id === journal.id ? (
                                              <Check className="h-5 w-5" />
                                            ) : (
                                              <BookOpen className="h-5 w-5" />
                                            )}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                              <h5 className="font-medium text-sm" data-testid={`text-journal-name-${journal.id}`}>
                                                {journal.name}
                                              </h5>
                                              {selectedJournal?.id === journal.id && (
                                                <Badge className="bg-ros-workflow text-white border-0 text-xs">
                                                  Selected
                                                </Badge>
                                              )}
                                              {journal.openAccess && (
                                                <Badge className="bg-ros-success/10 text-ros-success border-ros-success/20 text-xs">
                                                  Open Access
                                                </Badge>
                                              )}
                                            </div>
                                            
                                            <div className="flex flex-wrap gap-3 text-xs mb-3">
                                              <div className="flex items-center gap-1">
                                                <span className="text-muted-foreground">IF:</span>
                                                <span className="font-medium text-ros-primary">{journal.impactFactor}</span>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <span className="text-muted-foreground">Acceptance:</span>
                                                <span className="font-medium">{journal.acceptanceRate}</span>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <span className="text-muted-foreground">Review:</span>
                                                <span className="font-medium">{journal.reviewTime}</span>
                                              </div>
                                              {journal.publicationFee && (
                                                <div className="flex items-center gap-1">
                                                  <span className="text-muted-foreground">Fee:</span>
                                                  <span className="font-medium">{journal.publicationFee}</span>
                                                </div>
                                              )}
                                            </div>
                                            
                                            <div className="mb-3">
                                              <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs text-muted-foreground">Fit Score:</span>
                                                <span className="text-xs font-medium text-ros-workflow">{journal.fitScore}%</span>
                                              </div>
                                              <Progress value={journal.fitScore} className="h-2" />
                                            </div>
                                            
                                            <div className="space-y-2">
                                              {journal.strengths.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                  {journal.strengths.slice(0, 2).map((strength, idx) => (
                                                    <Badge key={idx} className="bg-ros-success/10 text-ros-success border-ros-success/20 text-xs">
                                                      {strength}
                                                    </Badge>
                                                  ))}
                                                  {journal.strengths.length > 2 && (
                                                    <Badge variant="secondary" className="text-xs">
                                                      +{journal.strengths.length - 2} more
                                                    </Badge>
                                                  )}
                                                </div>
                                              )}
                                              {journal.weaknesses.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                  {journal.weaknesses.slice(0, 2).map((weakness, idx) => (
                                                    <Badge key={idx} className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-xs">
                                                      {weakness}
                                                    </Badge>
                                                  ))}
                                                  {journal.weaknesses.length > 2 && (
                                                    <Badge variant="secondary" className="text-xs">
                                                      +{journal.weaknesses.length - 2} more
                                                    </Badge>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </motion.button>
                                    ))}
                                  </div>

                                  {selectedJournal && (
                                    <div className="p-3 rounded-lg bg-ros-workflow/5 border border-ros-workflow/20">
                                      <div className="flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4 text-ros-workflow" />
                                        <p className="text-sm text-ros-workflow font-medium">
                                          Selected: {selectedJournal.name}
                                        </p>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Proceed to Conference Readiness stages to prepare your submission
                                      </p>
                                    </div>
                                  )}

                                  {!selectedJournal && (
                                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                                      <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                                      <p className="text-xs text-amber-600 dark:text-amber-400">
                                        Select a target journal to continue with submission preparation
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {getStageStatus(selectedStage) === 'pending' && !canExecuteStage(selectedStage.id) && (
                            <div className="text-center py-6 bg-muted/30 rounded-lg">
                              <p className="text-sm text-muted-foreground mb-2">
                                {selectedStage.id === 12 && executionState[11]?.status === 'completed' && !selectedManuscript
                                  ? 'Select a manuscript proposal from the Manuscript Ideation stage to continue'
                                  : selectedStage.id >= 17 && selectedStage.id <= 19 && executionState[16]?.status === 'completed' && !selectedJournal
                                  ? 'Select a target journal from the Journal Selection stage to continue'
                                  : 'Complete previous stages to unlock this step'}
                              </p>
                              {selectedStage.id === 12 && executionState[11]?.status === 'completed' && !selectedManuscript && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const stage11 = stageGroups?.flatMap(g => g.stages).find(s => s.id === 11);
                                    if (stage11) setSelectedStage(stage11);
                                  }}
                                  className="mt-2"
                                  data-testid="button-go-to-ideation"
                                >
                                  Go to Manuscript Ideation
                                </Button>
                              )}
                              {selectedStage.id >= 17 && selectedStage.id <= 19 && executionState[16]?.status === 'completed' && !selectedJournal && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const stage16 = stageGroups?.flatMap(g => g.stages).find(s => s.id === 16);
                                    if (stage16) setSelectedStage(stage16);
                                  }}
                                  className="mt-2"
                                  data-testid="button-go-to-journal-selection"
                                >
                                  Go to Journal Selection
                                </Button>
                              )}
                            </div>
                          )}

                          {/* Stage 12: Show selected manuscript info */}
                          {selectedStage.id === 12 && selectedManuscript && getStageStatus(selectedStage) === 'pending' && canExecuteStage(12) && (
                            <div className="space-y-4 mb-4" data-testid="section-selected-manuscript-preview">
                              <div className="flex items-center gap-2">
                                <MousePointerClick className="h-5 w-5 text-ros-workflow" />
                                <h4 className="font-medium">Selected Manuscript</h4>
                              </div>
                              <div className="p-4 rounded-lg border-2 border-ros-workflow bg-ros-workflow/5">
                                <h5 className="font-medium mb-2" data-testid="text-selected-manuscript-title">{selectedManuscript.title}</h5>
                                <div className="flex flex-wrap gap-3 text-xs mb-3">
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Relevance:</span>
                                    <span className="font-medium text-ros-success" data-testid="text-selected-relevance">{selectedManuscript.relevance}/100</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Novelty:</span>
                                    <span className="font-medium text-ros-workflow" data-testid="text-selected-novelty">{selectedManuscript.novelty}/100</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Feasibility:</span>
                                    <span className="font-medium text-ros-primary" data-testid="text-selected-feasibility">{selectedManuscript.feasibility}/100</span>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-1" data-testid="list-selected-journals">
                                  {selectedManuscript.targetJournals.map((journal, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      {journal}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Click Execute to proceed with developing this manuscript
                              </p>
                            </div>
                          )}

                          {/* Stages 17-19: Show selected journal info */}
                          {selectedStage.id >= 17 && selectedStage.id <= 19 && selectedJournal && getStageStatus(selectedStage) === 'pending' && canExecuteStage(selectedStage.id) && (
                            <div className="space-y-4 mb-4" data-testid="section-selected-journal-preview">
                              <div className="flex items-center gap-2">
                                <Send className="h-5 w-5 text-ros-workflow" />
                                <h4 className="font-medium">Target Journal</h4>
                              </div>
                              <div className="p-4 rounded-lg border-2 border-ros-workflow bg-ros-workflow/5">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <h5 className="font-medium" data-testid="text-selected-journal-name">{selectedJournal.name}</h5>
                                  {selectedJournal.openAccess && (
                                    <Badge className="bg-ros-success/10 text-ros-success border-ros-success/20 text-xs">
                                      Open Access
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-3 text-xs mb-3">
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Impact Factor:</span>
                                    <span className="font-medium text-ros-primary" data-testid="text-selected-impact-factor">{selectedJournal.impactFactor}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Acceptance:</span>
                                    <span className="font-medium" data-testid="text-selected-acceptance-rate">{selectedJournal.acceptanceRate}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Review Time:</span>
                                    <span className="font-medium" data-testid="text-selected-review-time">{selectedJournal.reviewTime}</span>
                                  </div>
                                  {selectedJournal.publicationFee && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-muted-foreground">Fee:</span>
                                      <span className="font-medium" data-testid="text-selected-publication-fee">{selectedJournal.publicationFee}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="mb-3">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs text-muted-foreground">Fit Score:</span>
                                    <span className="text-xs font-medium text-ros-workflow" data-testid="text-selected-fit-score">{selectedJournal.fitScore}%</span>
                                  </div>
                                  <Progress value={selectedJournal.fitScore} className="h-2" />
                                </div>
                                <div className="space-y-2" data-testid="list-selected-journal-details">
                                  {selectedJournal.strengths.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {selectedJournal.strengths.map((strength, idx) => (
                                        <Badge key={idx} className="bg-ros-success/10 text-ros-success border-ros-success/20 text-xs">
                                          {strength}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                  {selectedJournal.weaknesses.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {selectedJournal.weaknesses.map((weakness, idx) => (
                                        <Badge key={idx} className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-xs">
                                          {weakness}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Click Execute to proceed with preparing your submission
                              </p>
                            </div>
                          )}

                          {getStageStatus(selectedStage) === 'pending' && canExecuteStage(selectedStage.id) && (
                            <div className="space-y-4">
                              {/* Research Overview Statement - Primary Input for Topic Declaration */}
                              {selectedStage.scopeRefinement?.enabled && (
                                <Card className="p-4 border-ros-primary/30 bg-ros-primary/5" data-testid="card-research-overview">
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                      <FileText className="h-4 w-4 text-ros-primary" />
                                      <h4 className="font-medium">Research Overview</h4>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                      Describe your research question in your own words. What do you want to study?
                                    </p>
                                    <Textarea
                                      placeholder="e.g., I want to investigate whether subclinical hypothyroidism is associated with increased cardiovascular risk in middle-aged adults, focusing on patients from our thyroid clinic database..."
                                      value={getCurrentOverview()}
                                      onChange={(e) => handleOverviewChange(e.target.value)}
                                      className="min-h-[100px] bg-background"
                                      data-testid="textarea-research-overview"
                                    />
                                    {getCurrentOverview() && (
                                      <div className="flex items-center gap-2 text-xs text-ros-success">
                                        <Check className="h-3 w-3" />
                                        <span>Overview captured ({getCurrentOverview().split(/\s+/).filter(Boolean).length} words)</span>
                                      </div>
                                    )}
                                  </div>
                                </Card>
                              )}

                              {/* AI Insights & Recommendations Button (Stage 1 only) */}
                              {selectedStage.id === 1 && (
                                <div className="space-y-4">
                                  <Button
                                    onClick={handleRequestAIInsights}
                                    disabled={!getCurrentOverview() || getCurrentOverview().trim().length < 20 || isLoadingRecommendations}
                                    className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
                                    data-testid="button-ai-insights"
                                  >
                                    {isLoadingRecommendations ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Generating AI Insights...
                                      </>
                                    ) : (
                                      <>
                                        <Bot className="h-4 w-4 mr-2" />
                                        AI Insights & Recommendations
                                      </>
                                    )}
                                  </Button>

                                  {/* Display AI Recommendations */}
                                  {aiRecommendations && (
                                    <TopicCardRecommendations
                                      data={aiRecommendations}
                                      onApplyRecommendation={handleApplyRecommendation}
                                      onDismiss={handleDismissRecommendations}
                                    />
                                  )}
                                </div>
                              )}

                              <div>
                                <h4 className="font-medium mb-3">Expected Outputs:</h4>
                                <div className="flex flex-wrap gap-2" data-testid="list-stage-outputs">
                                  {selectedStage.outputs.map((output, index) => (
                                    <Badge 
                                      key={index} 
                                      variant="secondary"
                                      className="px-3 py-1.5"
                                      data-testid={`badge-output-${index}`}
                                    >
                                      {output}
                                    </Badge>
                                  ))}
                                </div>
                              </div>

                              {/* Research Brief Panel with Version Tracking */}
                              {selectedStage.id === 1 && topicVersionHistory.currentVersion > 0 && (
                                <div className="space-y-3" data-testid="section-research-brief">
                                  <ResearchBriefPanel
                                    versionHistory={topicVersionHistory}
                                    onVersionSelect={(v) => console.log('Selected version:', v)}
                                    onLock={handleLockTopic}
                                    isLocked={isTopicLocked}
                                  />
                                </div>
                              )}

                              {/* PICO Framework - Secondary/Optional Refinement */}
                              {selectedStage.scopeRefinement?.enabled && (
                                <Collapsible 
                                  open={showPicoRefinement} 
                                  onOpenChange={setShowPicoRefinement}
                                  data-testid="section-scope-refinement"
                                >
                                  <CollapsibleTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      className="w-full justify-between"
                                      data-testid="button-toggle-pico"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Target className="h-4 w-4 text-ros-workflow" />
                                        <span className="font-medium">Refine Scope (PICO Framework)</span>
                                        <Badge variant="secondary" className="text-xs">Optional</Badge>
                                        {topicVersionHistory.currentVersion > 0 && (
                                          <TopicVersionBadge version={topicVersionHistory.currentVersion} size="sm" />
                                        )}
                                      </div>
                                      {showPicoRefinement ? (
                                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                      )}
                                    </Button>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="pt-4">
                                    <div className="space-y-4 pl-2 border-l-2 border-ros-workflow/20">
                                      <p className="text-sm text-muted-foreground">
                                        Optionally structure your research using the PICO framework for more targeted results.
                                      </p>
                                      <div className="grid gap-4">
                                        {selectedStage.scopeRefinement.subsections.map((subsection) => {
                                          const sectionSuggestions = selectedStage.aiSuggestions?.filter(
                                            s => s.targetSection === subsection.id
                                          ) || [];
                                          
                                          return (
                                            <div key={subsection.id} className="space-y-2" data-testid={`scope-field-${subsection.id}`}>
                                              <Label htmlFor={subsection.id} className="text-sm text-muted-foreground">
                                                {subsection.label}
                                                {getCurrentScopeValues()[subsection.id] && (
                                                  <Badge variant="secondary" className="ml-2 text-xs bg-ros-success/10 text-ros-success">
                                                    AI-Enhanced
                                                  </Badge>
                                                )}
                                              </Label>
                                              <Input 
                                                id={subsection.id}
                                                placeholder={subsection.placeholder}
                                                className={`bg-muted/50 transition-all ${getCurrentScopeValues()[subsection.id] ? 'ring-1 ring-ros-success/30 bg-ros-success/5' : ''}`}
                                                value={getCurrentScopeValues()[subsection.id] || ""}
                                                onChange={(e) => handleScopeChange(subsection.id, e.target.value)}
                                                data-testid={`input-scope-${subsection.id}`}
                                              />
                                              
                                              {sectionSuggestions.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mt-1">
                                                  {sectionSuggestions.map((suggestion, idx) => {
                                                    const globalIndex = selectedStage.aiSuggestions?.findIndex(s => s === suggestion) ?? idx;
                                                    const isApplied = getAppliedSuggestions().has(globalIndex);
                                                    
                                                    return (
                                                      <button
                                                        key={idx}
                                                        onClick={() => !isApplied && handleApplySuggestion(suggestion, globalIndex)}
                                                        disabled={isApplied}
                                                        className={`
                                                          inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all
                                                          ${isApplied ? 'opacity-50 cursor-default' : 'cursor-pointer hover:scale-105'}
                                                          ${suggestion.type === 'narrow' ? 'bg-ros-workflow/10 text-ros-workflow border border-ros-workflow/20' : ''}
                                                          ${suggestion.type === 'expand' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' : ''}
                                                          ${suggestion.type === 'improve' ? 'bg-ros-success/10 text-ros-success border border-ros-success/20' : ''}
                                                        `}
                                                        data-testid={`suggestion-${subsection.id}-${idx}`}
                                                      >
                                                        {suggestion.type === 'narrow' && <ArrowDownRight className="h-3 w-3" />}
                                                        {suggestion.type === 'expand' && <ArrowUpRight className="h-3 w-3" />}
                                                        {suggestion.type === 'improve' && <Zap className="h-3 w-3" />}
                                                        <span className="max-w-[200px] truncate">{suggestion.text}</span>
                                                        {isApplied && <Check className="h-3 w-3 ml-1" />}
                                                      </button>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                      
                                      {selectedStage.id === 1 && Object.keys(getCurrentScopeValues()).length > 0 && !isTopicLocked && (
                                        <div className="flex items-center gap-2 pt-3 border-t border-border">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleSaveTopicVersion}
                                            className="gap-2"
                                            data-testid="button-save-topic-version"
                                          >
                                            <History className="h-3.5 w-3.5" />
                                            Save as New Version
                                          </Button>
                                          <span className="text-xs text-muted-foreground">
                                            {topicVersionHistory.currentVersion > 0 
                                              ? `Current: v${topicVersionHistory.currentVersion}` 
                                              : 'No versions saved yet'}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              )}

                            </div>
                          )}
                        </div>
                    </Card>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full"
                  >
                    <Card className="p-6 border-border/50 border-dashed" data-testid="card-stage-empty">
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                          <MousePointerClick className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h4 className="font-medium mb-2">Select a Stage</h4>
                        <p className="text-sm text-muted-foreground max-w-[200px]">
                          Click on any stage in the pipeline to view its details and outputs
                        </p>
                      </div>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Attestation Modal */}
      {pendingAttestation && (
        <AttestationModal
          isOpen={!!pendingAttestation}
          onClose={handleAttestationCancel}
          onConfirm={handleAttestationConfirm}
          gate={pendingAttestation.gate}
          stageName={pendingAttestation.stageName}
          currentState={lifecycleState}
        />
      )}

      {/* PHI Gate Modal */}
      {phiGateStageId && (
        <PhiGate
          stageId={phiGateStageId}
          isOpen={phiGateOpen}
          onOpenChange={setPhiGateOpen}
          onPass={handlePhiGatePass}
          onFail={handlePhiGateClose}
        />
      )}

      {/* AI Consent Authorization Modal */}
      <AIConsentModal
        isOpen={showConsentModal}
        onOpenChange={setShowConsentModal}
        onAuthorize={handleAuthorizeAI}
        scope="topic-declaration-recommendations"
        scopeDescription="You are about to request AI-generated recommendations for refining your research topic declaration. The system will analyze your research overview and provide suggestions for each PICO field."
      />

    </section>
    </>
  );
}
