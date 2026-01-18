import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sparkles, Brain, Search, FileText, Target, BookOpen,
  ChevronDown, ChevronUp, Loader2, AlertTriangle, CheckCircle,
  TrendingUp, TrendingDown, Minus, Star, Lightbulb
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { 
  ResearchBrief, EvidenceGapMap, StudyCard, DecisionMatrix, TargetJournal 
} from "@packages/core/types";
import type { AIApprovalGateResult } from "@/components/ui/ai-approval-gate";

export interface AIInsightsPanelProps {
  onStudyCardsGenerated?: (cards: StudyCard[]) => void;
  onRequestAIApproval?: (toolName: string, toolDescription: string) => Promise<AIApprovalGateResult>;
}

function AcceptanceBadge({ likelihood }: { likelihood: "high" | "medium" | "low" }) {
  const styles = {
    high: "bg-ros-success/10 text-ros-success border-ros-success/20",
    medium: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    low: "bg-ros-alert/10 text-ros-alert border-ros-alert/20",
  };
  
  const icons = {
    high: <TrendingUp className="h-3 w-3 mr-1" />,
    medium: <Minus className="h-3 w-3 mr-1" />,
    low: <TrendingDown className="h-3 w-3 mr-1" />,
  };

  return (
    <Badge className={`${styles[likelihood]} flex items-center`} data-testid={`badge-acceptance-${likelihood}`}>
      {icons[likelihood]}
      {likelihood.charAt(0).toUpperCase() + likelihood.slice(1)} Acceptance
    </Badge>
  );
}

function JournalCard({ journal, index }: { journal: TargetJournal; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="p-4 border-border/50" data-testid={`card-journal-${index}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h5 className="font-semibold text-sm">{journal.name}</h5>
            <Badge variant="outline" className="text-xs" data-testid="badge-impact-factor">
              IF: {journal.impactFactor.toFixed(1)}
            </Badge>
            <AcceptanceBadge likelihood={journal.acceptanceLikelihood} />
          </div>
          
          <p className="text-xs text-muted-foreground mb-2">{journal.audience}</p>
          
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" data-testid="button-expand-journal">
                {expanded ? (
                  <>Hide Details <ChevronUp className="h-3 w-3 ml-1" /></>
                ) : (
                  <>Show Details <ChevronDown className="h-3 w-3 ml-1" /></>
                )}
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="space-y-3 mt-3">
              <div>
                <h6 className="text-xs font-medium text-ros-success mb-1 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Why This Journal Fits
                </h6>
                <p className="text-xs text-muted-foreground">{journal.whyThisJournal}</p>
              </div>
              
              {journal.alignment && journal.alignment.length > 0 && (
                <div>
                  <h6 className="text-xs font-medium text-ros-primary mb-1">Alignment</h6>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    {journal.alignment.map((item, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-ros-success mt-0.5">+</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {journal.potentialGaps && journal.potentialGaps.length > 0 && (
                <div>
                  <h6 className="text-xs font-medium text-ros-alert mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Areas to Strengthen
                  </h6>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    {journal.potentialGaps.map((gap, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-ros-alert mt-0.5">!</span> {gap}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="flex gap-4 text-xs text-muted-foreground pt-1">
                <span>Word limit: {journal.wordLimit?.toLocaleString() || "N/A"}</span>
                <span>Figure limit: {journal.figureLimit || "N/A"}</span>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </Card>
  );
}

function StudyCardDisplay({ card, isRecommended }: { card: StudyCard; isRecommended?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [showJournals, setShowJournals] = useState(false);

  return (
    <Card 
      className={`p-4 ${isRecommended ? 'ring-2 ring-ros-success/50 bg-ros-success/5' : ''}`}
      data-testid={`card-study-${card.id}`}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {isRecommended && (
                <Badge className="bg-ros-success text-white" data-testid="badge-recommended">
                  <Star className="h-3 w-3 mr-1" /> Recommended
                </Badge>
              )}
              <Badge variant="outline">Study #{card.id}</Badge>
            </div>
            <h4 className="font-semibold text-sm leading-tight">{card.title}</h4>
          </div>
          
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Feasibility</span>
              <Badge 
                className={`${card.feasibilityScore >= 80 ? 'bg-ros-success/10 text-ros-success' : card.feasibilityScore >= 60 ? 'bg-amber-500/10 text-amber-600' : 'bg-ros-alert/10 text-ros-alert'}`}
                data-testid="badge-feasibility"
              >
                {card.feasibilityScore}%
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <div>
            <span className="text-xs font-medium text-muted-foreground">Research Question:</span>
            <p className="text-sm">{card.researchQuestion}</p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="text-xs">{card.plannedMethod}</Badge>
            {card.exposures?.slice(0, 2).map((exp, i) => (
              <Badge key={i} variant="outline" className="text-xs">{exp}</Badge>
            ))}
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setExpanded(!expanded)}
            className="flex-1"
            data-testid="button-view-details"
          >
            {expanded ? "Hide" : "View"} Study Details
            {expanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
          </Button>
          
          <Button 
            variant={showJournals ? "default" : "outline"}
            size="sm" 
            onClick={() => setShowJournals(!showJournals)}
            className={`flex-1 ${showJournals ? 'bg-ros-primary hover:bg-ros-primary/90' : ''}`}
            data-testid="button-view-journals"
          >
            <BookOpen className="h-3 w-3 mr-1" />
            {showJournals ? "Hide" : "View"} Journals ({card.targetJournals?.length || 0})
          </Button>
        </div>
        
        {expanded && (
          <div className="space-y-3 pt-2 border-t">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs font-medium text-muted-foreground block mb-1">Hypothesis</span>
                <p className="text-xs">{card.hypothesis}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground block mb-1">Index Date</span>
                <p className="text-xs">{card.indexDate}</p>
              </div>
            </div>
            
            <div>
              <span className="text-xs font-medium text-muted-foreground block mb-1">Cohort Definition</span>
              <p className="text-xs">{card.cohortDefinition}</p>
            </div>
            
            {card.threatsToValidity && card.threatsToValidity.length > 0 && (
              <div>
                <span className="text-xs font-medium text-ros-alert block mb-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Threats to Validity
                </span>
                <div className="space-y-1">
                  {card.threatsToValidity.slice(0, 3).map((t, i) => (
                    <div key={i} className="text-xs p-2 rounded bg-muted/50">
                      <span className="font-medium">{t.threat}:</span>{" "}
                      <span className="text-muted-foreground">{t.mitigation}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {showJournals && card.targetJournals && card.targetJournals.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <h5 className="text-xs font-medium flex items-center gap-1">
              <BookOpen className="h-3 w-3" /> Target Journals
            </h5>
            <div className="space-y-2">
              {card.targetJournals.map((journal, idx) => (
                <JournalCard key={idx} journal={journal} index={idx} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export function AIInsightsPanel({ onStudyCardsGenerated, onRequestAIApproval }: AIInsightsPanelProps) {
  const [topic, setTopic] = useState("");
  const [population, setPopulation] = useState("");
  const [outcomes, setOutcomes] = useState("");
  
  const [researchBrief, setResearchBrief] = useState<ResearchBrief | null>(null);
  const [evidenceGapMap, setEvidenceGapMap] = useState<EvidenceGapMap | null>(null);
  const [studyCards, setStudyCards] = useState<StudyCard[]>([]);
  const [decisionMatrix, setDecisionMatrix] = useState<DecisionMatrix | null>(null);
  
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [awaitingApproval, setAwaitingApproval] = useState(false);

  const requestApprovalIfNeeded = async (toolName: string, toolDescription: string): Promise<boolean> => {
    if (!onRequestAIApproval) return true;
    
    setAwaitingApproval(true);
    try {
      const result = await onRequestAIApproval(toolName, toolDescription);
      return result.approved;
    } finally {
      setAwaitingApproval(false);
    }
  };

  const briefMutation = useMutation({
    mutationFn: async () => {
      const approved = await requestApprovalIfNeeded("Research Brief Generator", "Generate PICO-structured research brief with clarifying prompts");
      if (!approved) throw new Error("AI approval denied");
      
      const res = await apiRequest("POST", "/api/ai/research-brief", { topic });
      return res.json();
    },
    onSuccess: (data) => {
      setResearchBrief(data.brief);
      setActiveSection("brief");
    }
  });

  const gapMapMutation = useMutation({
    mutationFn: async () => {
      const approved = await requestApprovalIfNeeded("Evidence Gap Map", "Analyze research landscape for knowns, unknowns, methods, and pitfalls");
      if (!approved) throw new Error("AI approval denied");
      
      const res = await apiRequest("POST", "/api/ai/evidence-gap-map", { 
        topic, 
        population: population || researchBrief?.population,
        outcomes: outcomes ? outcomes.split(",").map(o => o.trim()) : researchBrief?.outcomes 
      });
      return res.json();
    },
    onSuccess: (data) => {
      setEvidenceGapMap(data.evidenceGapMap);
      setActiveSection("gaps");
    }
  });

  const studyCardsMutation = useMutation({
    mutationFn: async () => {
      const approved = await requestApprovalIfNeeded("Study Card Generator", "Generate 5-10 study proposals with feasibility scores and target journals");
      if (!approved) throw new Error("AI approval denied");
      
      const res = await apiRequest("POST", "/api/ai/study-cards", { 
        topic,
        researchBrief,
        count: 7
      });
      return res.json();
    },
    onSuccess: (data) => {
      setStudyCards(data.studyCards);
      setActiveSection("cards");
      onStudyCardsGenerated?.(data.studyCards);
    }
  });

  const decisionMutation = useMutation({
    mutationFn: async () => {
      const approved = await requestApprovalIfNeeded("Decision Matrix", "Rank proposals by novelty, feasibility, and clinical importance");
      if (!approved) throw new Error("AI approval denied");
      
      const res = await apiRequest("POST", "/api/ai/decision-matrix", { studyCards });
      return res.json();
    },
    onSuccess: (data) => {
      setDecisionMatrix(data.decisionMatrix);
      setActiveSection("decision");
    }
  });

  const handleGenerateAll = async () => {
    if (!topic.trim()) return;
    
    briefMutation.mutate();
  };

  const isLoading = awaitingApproval || briefMutation.isPending || gapMapMutation.isPending || 
                    studyCardsMutation.isPending || decisionMutation.isPending;

  return (
    <div className="space-y-6" data-testid="panel-ai-insights">
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-lg bg-ros-workflow/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-ros-workflow" />
          </div>
          <div>
            <h3 className="font-semibold">AI Research Assistant</h3>
            <p className="text-sm text-muted-foreground">Generate research insights powered by AI</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="topic">Research Topic</Label>
            <Textarea
              id="topic"
              placeholder="e.g., Association between subclinical hypothyroidism and cardiovascular outcomes in adults"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="mt-1"
              data-testid="input-topic"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="population">Target Population (optional)</Label>
              <Input
                id="population"
                placeholder="e.g., Adults 40-75 years"
                value={population}
                onChange={(e) => setPopulation(e.target.value)}
                className="mt-1"
                data-testid="input-population"
              />
            </div>
            <div>
              <Label htmlFor="outcomes">Primary Outcomes (optional)</Label>
              <Input
                id="outcomes"
                placeholder="e.g., cardiovascular events, mortality"
                value={outcomes}
                onChange={(e) => setOutcomes(e.target.value)}
                className="mt-1"
                data-testid="input-outcomes"
              />
            </div>
          </div>

          <Button
            onClick={handleGenerateAll}
            disabled={!topic.trim() || isLoading}
            className="w-full bg-ros-workflow hover:bg-ros-workflow/90"
            data-testid="button-generate-brief"
          >
            {briefMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Research Brief...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Generate Research Brief
              </>
            )}
          </Button>
        </div>
      </Card>

      {researchBrief && (
        <Card className="p-6" data-testid="card-research-brief">
          <Collapsible open={activeSection === "brief"} onOpenChange={(open) => setActiveSection(open ? "brief" : null)}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-ros-primary" />
                  <h3 className="font-semibold">Research Brief (PICO)</h3>
                  <Badge className="bg-ros-success/10 text-ros-success">Generated</Badge>
                </div>
                {activeSection === "brief" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <span className="text-xs font-medium text-muted-foreground">Population</span>
                  <p className="text-sm mt-1">{researchBrief.population}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <span className="text-xs font-medium text-muted-foreground">Exposure/Intervention</span>
                  <p className="text-sm mt-1">{researchBrief.exposure}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <span className="text-xs font-medium text-muted-foreground">Comparator</span>
                  <p className="text-sm mt-1">{researchBrief.comparator}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <span className="text-xs font-medium text-muted-foreground">Timeframe</span>
                  <p className="text-sm mt-1">{researchBrief.timeframe}</p>
                </div>
              </div>
              
              <div className="p-3 rounded-lg bg-muted/50">
                <span className="text-xs font-medium text-muted-foreground">Study Objectives</span>
                <ul className="mt-1 space-y-1">
                  {researchBrief.studyObjectives.map((obj, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <Target className="h-3 w-3 mt-1 text-ros-primary flex-shrink-0" />
                      {obj}
                    </li>
                  ))}
                </ul>
              </div>
              
              {researchBrief.clarifyingPrompts && researchBrief.clarifyingPrompts.length > 0 && (
                <div className="p-3 rounded-lg bg-ros-workflow/5 border border-ros-workflow/20">
                  <span className="text-xs font-medium text-ros-workflow flex items-center gap-1">
                    <Lightbulb className="h-3 w-3" /> Clarifying Questions
                  </span>
                  <ul className="mt-2 space-y-1">
                    {researchBrief.clarifyingPrompts.map((prompt, i) => (
                      <li key={i} className="text-sm text-muted-foreground">• {prompt}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <Button
                onClick={() => gapMapMutation.mutate()}
                disabled={gapMapMutation.isPending}
                variant="outline"
                className="w-full"
                data-testid="button-generate-gaps"
              >
                {gapMapMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing Literature...</>
                ) : (
                  <><Search className="h-4 w-4 mr-2" /> Generate Evidence Gap Map</>
                )}
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {evidenceGapMap && (
        <Card className="p-6" data-testid="card-evidence-gap">
          <Collapsible open={activeSection === "gaps"} onOpenChange={(open) => setActiveSection(open ? "gaps" : null)}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-ros-primary" />
                  <h3 className="font-semibold">Evidence Gap Map</h3>
                  <Badge className="bg-ros-success/10 text-ros-success">Generated</Badge>
                </div>
                {activeSection === "gaps" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-ros-success/5 border border-ros-success/20">
                  <span className="text-xs font-medium text-ros-success">Known Evidence</span>
                  <ul className="mt-2 space-y-2">
                    {evidenceGapMap.knowns?.slice(0, 3).map((k, i) => (
                      <li key={i} className="text-sm">
                        <span className="font-medium">{k.finding}</span>
                        <p className="text-xs text-muted-foreground">{k.evidence}</p>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="p-3 rounded-lg bg-ros-alert/5 border border-ros-alert/20">
                  <span className="text-xs font-medium text-ros-alert">Research Gaps</span>
                  <ul className="mt-2 space-y-2">
                    {evidenceGapMap.unknowns?.slice(0, 3).map((u, i) => (
                      <li key={i} className="text-sm">
                        <span className="font-medium">{u.gap}</span>
                        <p className="text-xs text-muted-foreground">{u.importance}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              
              <Button
                onClick={() => studyCardsMutation.mutate()}
                disabled={studyCardsMutation.isPending}
                variant="outline"
                className="w-full"
                data-testid="button-generate-cards"
              >
                {studyCardsMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating Study Ideas...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" /> Generate 5-10 Study Cards</>
                )}
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {studyCards.length > 0 && (
        <Card className="p-6" data-testid="card-study-cards">
          <Collapsible open={activeSection === "cards"} onOpenChange={(open) => setActiveSection(open ? "cards" : null)}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-ros-workflow" />
                  <h3 className="font-semibold">AI-Generated Study Cards</h3>
                  <Badge className="bg-ros-success/10 text-ros-success">{studyCards.length} Proposals</Badge>
                </div>
                {activeSection === "cards" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="mt-4 space-y-4">
              <div className="space-y-3">
                {studyCards.map((card) => (
                  <StudyCardDisplay 
                    key={card.id} 
                    card={card} 
                    isRecommended={decisionMatrix?.recommendedPick === card.id}
                  />
                ))}
              </div>
              
              {!decisionMatrix && (
                <Button
                  onClick={() => decisionMutation.mutate()}
                  disabled={decisionMutation.isPending}
                  className="w-full bg-ros-primary hover:bg-ros-primary/90"
                  data-testid="button-generate-decision"
                >
                  {decisionMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing...</>
                  ) : (
                    <><Target className="h-4 w-4 mr-2" /> Generate Decision Matrix</>
                  )}
                </Button>
              )}
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {decisionMatrix && (
        <Card className="p-6 bg-ros-primary/5 border-ros-primary/20" data-testid="card-decision-matrix">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5 text-ros-primary" />
            <h3 className="font-semibold">AI Recommendation</h3>
          </div>
          
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-background border">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-5 w-5 text-ros-success" />
                <span className="font-semibold">Recommended Study: #{decisionMatrix.recommendedPick}</span>
              </div>
              <ul className="space-y-1">
                {decisionMatrix.reasons?.map((reason, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <CheckCircle className="h-3 w-3 mt-1 text-ros-success flex-shrink-0" />
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">#</th>
                    <th className="text-left py-2 font-medium">Novelty</th>
                    <th className="text-left py-2 font-medium">Feasibility</th>
                    <th className="text-left py-2 font-medium">Clinical Impact</th>
                    <th className="text-left py-2 font-medium">Time</th>
                    <th className="text-left py-2 font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {decisionMatrix.proposals?.map((p) => (
                    <tr key={p.id} className={`border-b ${p.id === decisionMatrix.recommendedPick ? 'bg-ros-success/10' : ''}`}>
                      <td className="py-2">{p.id}</td>
                      <td className="py-2"><Progress value={p.novelty} className="w-16 h-2" /></td>
                      <td className="py-2"><Progress value={p.feasibility} className="w-16 h-2" /></td>
                      <td className="py-2"><Progress value={p.clinicalImportance} className="w-16 h-2" /></td>
                      <td className="py-2 text-xs">{p.timeToExecute}</td>
                      <td className="py-2 font-semibold">{p.overallScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
