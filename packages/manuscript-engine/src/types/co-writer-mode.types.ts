/**
 * Co-Writer Mode Types
 * Task T76: Live AI suggestion system
 */

export interface CoWriterConfig {
  enabled: boolean;
  model: 'gpt-4' | 'claude-3-opus' | 'claude-3-sonnet' | 'claude-3-haiku';
  triggerMode: 'automatic' | 'manual' | 'on_pause';
  suggestionDelay: number; // Milliseconds
  maxSuggestions: number;
  contextWindow: number; // Number of previous sentences to include
  style: WritingPreferences;
  enabledSections?: string[]; // Sections where co-writer is active
}

export interface WritingPreferences {
  tone: 'formal' | 'semi_formal' | 'conversational';
  voice: 'active' | 'passive' | 'mixed';
  tense: 'past' | 'present' | 'future';
  complexity: 'expert' | 'general_medical' | 'general_audience';
  citationStyle: 'AMA' | 'APA' | 'Vancouver' | 'NLM';
  preferredPhrasing?: 'concise' | 'detailed' | 'balanced';
}

export interface InlineSuggestion {
  id: string;
  type: 'completion' | 'replacement' | 'insertion' | 'citation' | 'data_reference';
  manuscriptId: string;
  section: string;
  position: {
    offset: number;
    length: number;
  };
  context: SuggestionContext;
  suggestion: string;
  confidence: number; // 0-1
  reasoning?: string;
  alternatives?: string[];
  metadata: SuggestionMetadata;
  createdAt: Date;
  status: 'pending' | 'accepted' | 'rejected' | 'modified' | 'expired';
}

export interface SuggestionContext {
  precedingText: string;
  followingText?: string;
  currentSentence: string;
  previousSentences: string[];
  sectionContext: string;
  availableCitations?: CitationContext[];
  availableData?: DataContext[];
  outlinePoint?: string;
}

export interface CitationContext {
  id: string;
  shortRef: string; // "Smith et al., 2023"
  relevance: number;
  keyFindings: string[];
}

export interface DataContext {
  id: string;
  description: string;
  value: string | number;
  unit?: string;
  relevance: number;
}

export interface SuggestionMetadata {
  modelUsed: string;
  tokensUsed: number;
  latency: number; // Milliseconds
  triggerType: 'keystroke' | 'pause' | 'tab' | 'manual';
  userWasTyping: boolean;
}

export interface CoWriterSession {
  id: string;
  manuscriptId: string;
  userId: string;
  startedAt: Date;
  endedAt?: Date;
  totalSuggestions: number;
  acceptedSuggestions: number;
  rejectedSuggestions: number;
  modifiedSuggestions: number;
  averageAcceptanceTime: number; // Seconds
  sections: SessionSection[];
  config: CoWriterConfig;
}

export interface SessionSection {
  section: string;
  suggestions: number;
  accepted: number;
  wordsWritten: number;
  aiAssistedWords: number;
  timeSpent: number; // Seconds
}

export interface SuggestionFeedback {
  suggestionId: string;
  userId: string;
  action: 'accepted' | 'rejected' | 'modified' | 'ignored';
  modifiedText?: string;
  reason?: SuggestionFeedbackReason;
  timestamp: Date;
}

export type SuggestionFeedbackReason =
  | 'incorrect_fact'
  | 'wrong_tone'
  | 'too_verbose'
  | 'too_concise'
  | 'missing_context'
  | 'inappropriate_citation'
  | 'grammatically_incorrect'
  | 'not_relevant'
  | 'prefer_own_wording'
  | 'other';

export interface AutoCompleteTrigger {
  type: 'typing_pause' | 'tab_key' | 'enter_key' | 'ctrl_space' | 'bullet_point' | 'sentence_end';
  position: number;
  context: string;
  timestamp: Date;
}

export interface SmartCompletion {
  type: 'sentence' | 'paragraph' | 'section' | 'citation' | 'statistic' | 'transition';
  template?: string;
  requiredFields?: string[];
  suggestion: string;
  confidence: number;
}

export interface WritingAssistantState {
  active: boolean;
  currentSuggestion?: InlineSuggestion;
  suggestionQueue: InlineSuggestion[];
  lastTrigger?: AutoCompleteTrigger;
  isGenerating: boolean;
  userIsTyping: boolean;
  lastKeystroke: Date;
}

export interface CitationSuggestion {
  id: string;
  citationId: string;
  shortRef: string;
  relevanceScore: number;
  suggestedPosition: number;
  reason: string;
  contextMatch: string;
  autoInsert: boolean;
}

export interface DataReferenceSuggestion {
  id: string;
  dataPointId: string;
  description: string;
  value: string | number;
  unit?: string;
  suggestedPhrasing: string[];
  position: number;
  confidence: number;
}

export interface TemplateExpansion {
  templateId: string;
  category: 'methods' | 'results' | 'discussion';
  template: string;
  filledTemplate: string;
  placeholders: Record<string, string>;
  position: number;
  confidence: number;
}

export interface CoWriterAnalytics {
  sessionId: string;
  userId: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  productivity: {
    wordsPerMinute: number;
    wordsPerMinuteWithAI: number;
    aiAssistedPercentage: number;
    totalWordsWritten: number;
    totalAIWords: number;
  };
  engagement: {
    suggestionAcceptanceRate: number;
    averageDecisionTime: number; // Seconds
    tabCompletionUsage: number;
    manualSuggestionRequests: number;
  };
  quality: {
    suggestionsPerMinute: number;
    averageSuggestionConfidence: number;
    rejectionReasons: Record<SuggestionFeedbackReason, number>;
  };
}

export interface CoWriterPrompt {
  systemPrompt: string;
  userPrompt: string;
  context: SuggestionContext;
  preferences: WritingPreferences;
  constraints?: {
    maxLength?: number;
    minLength?: number;
    mustIncludeCitation?: boolean;
    mustIncludeData?: boolean;
    avoidPhrases?: string[];
  };
}

export interface StreamedSuggestion {
  id: string;
  partialText: string;
  complete: boolean;
  tokens: string[];
  confidence: number;
  cancelRequested: boolean;
}

export interface CoWriterError {
  type: 'api_error' | 'timeout' | 'rate_limit' | 'invalid_context' | 'phi_detected';
  message: string;
  suggestion?: InlineSuggestion;
  recoverable: boolean;
  retryAfter?: number; // Seconds
}
