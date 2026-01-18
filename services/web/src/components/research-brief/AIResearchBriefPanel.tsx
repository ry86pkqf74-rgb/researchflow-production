import { useState, useEffect } from 'react';
import { useModeStore } from '@/stores/mode-store';
import { DemoOverlay } from '@/components/mode/DemoOverlay';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, AlertTriangle, Lightbulb, GitBranch, Clock, AlertCircle, Info } from 'lucide-react';
import type { EnhancedResearchBrief, RefinementSuggestions } from '@researchflow/core/types/research-brief';

interface TopicScopeData {
  population?: string;
  intervention?: string;
  comparator?: string;
  outcomes?: string;
  timeframe?: string;
}

interface AIResearchBriefPanelProps {
  topicDeclarationId?: string;
  topicVersion: number;
  topicData?: TopicScopeData;
}

const MOCK_DEMO_BRIEF: Partial<EnhancedResearchBrief> = {
  topicVersion: 1,
  summary: "This observational study investigates the relationship between subclinical hypothyroidism and cardiovascular outcomes in adults over 50. The research will utilize propensity score matching to control for confounders and assess both short-term and long-term cardiovascular events.",
  refinementSuggestions: {
    confounders: [
      { variable: "Age", rationale: "Older age independently increases both thyroid dysfunction and cardiovascular risk", priority: "high" },
      { variable: "BMI", rationale: "Obesity affects both thyroid function and cardiovascular health", priority: "high" },
      { variable: "Smoking status", rationale: "Smoking impacts thyroid function and is a major cardiovascular risk factor", priority: "medium" },
    ],
    biases: [
      { type: "Selection bias", description: "Patients with subclinical hypothyroidism may be more health-conscious and seek care more frequently", mitigation: "Use propensity score matching to balance baseline characteristics" },
      { type: "Information bias", description: "Outcome ascertainment may vary based on surveillance intensity", mitigation: "Use standardized outcome definitions and adjudication committees" },
    ],
    missingnessRisks: [
      { variable: "Lipid panel", expectedRate: "15-20%", strategy: "Multiple imputation using chained equations" },
      { variable: "TSH follow-up values", expectedRate: "25-30%", strategy: "Last observation carried forward with sensitivity analysis" },
    ],
    alternativeDesigns: [
      { design: "Target trial emulation", pros: ["Mimics RCT structure", "Reduces confounding"], cons: ["Complex implementation", "Requires detailed longitudinal data"] },
      { design: "Instrumental variable analysis", pros: ["Addresses unmeasured confounding", "Causal inference"], cons: ["Requires valid instrument", "May have weak instrument bias"] },
    ],
  },
  metadata: {
    modelUsed: "gpt-4o",
    promptVersion: "1.2.0",
    artifactHash: "demo-hash-abc123",
  },
};

function hasTopicData(data?: TopicScopeData): boolean {
  if (!data) return false;
  return Object.values(data).some(v => v && v.trim().length > 0);
}

export function AIResearchBriefPanel({ topicDeclarationId, topicVersion, topicData }: AIResearchBriefPanelProps) {
  const { isDemo, isLive } = useModeStore();
  const [brief, setBrief] = useState<Partial<EnhancedResearchBrief> | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const hasTopic = hasTopicData(topicData);
  const canGenerateInLive = isLive && topicDeclarationId;
  const canGenerate = isDemo || canGenerateInLive;
  
  useEffect(() => {
    if (topicDeclarationId && isLive) {
      loadBrief();
    }
  }, [topicDeclarationId, topicVersion, isLive]);
  
  const loadBrief = async () => {
    if (!topicDeclarationId || isDemo) {
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/research-briefs/topic/${topicDeclarationId}`);
      if (!response.ok) {
        if (response.status === 404) {
          setBrief(null);
          setLoading(false);
          return;
        }
        throw new Error('Failed to fetch briefs');
      }
      const data = await response.json();
      if (data.briefs && Array.isArray(data.briefs)) {
        const currentBrief = data.briefs.find((b: any) => b.topicVersion === topicVersion);
        setBrief(currentBrief || null);
      }
    } catch (err) {
      console.error('Error loading brief:', err);
      setError('Failed to load research brief');
    }
    setLoading(false);
  };
  
  const handleGenerate = async () => {
    if (isDemo) {
      setGenerating(true);
      await new Promise(resolve => setTimeout(resolve, 1500));
      setBrief({ ...MOCK_DEMO_BRIEF, topicVersion });
      setGenerating(false);
      return;
    }
    
    if (!topicDeclarationId) {
      setError('Topic must be saved before generating a research brief');
      return;
    }
    
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch('/api/research-briefs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicDeclarationId })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Generation failed');
      }
      const data = await response.json();
      setBrief(data.brief);
    } catch (err) {
      console.error('Error generating brief:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate brief');
    }
    setGenerating(false);
  };
  
  if (loading) {
    return (
      <Card className="p-4 bg-muted/50" data-testid="panel-ai-research-brief-loading">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4 animate-spin" />
          Loading research brief...
        </div>
      </Card>
    );
  }
  
  if (!hasTopic) {
    return (
      <Card className="p-4 bg-muted/30 border-border/50" data-testid="panel-ai-research-brief-no-topic">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Info className="w-4 h-4" />
          Enter topic details above to generate an AI research brief
        </div>
      </Card>
    );
  }
  
  const refinements = brief?.refinementSuggestions as RefinementSuggestions | undefined;
  const modelUsed = brief?.metadata?.modelUsed || 'gpt-4o';
  const promptVersion = brief?.metadata?.promptVersion || '1.0.0';
  
  return (
    <DemoOverlay>
      <Card className="p-6 bg-gradient-to-br from-muted/30 to-muted/50 border-border" data-testid="panel-ai-research-brief">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" data-testid="icon-sparkles" />
            <h3 className="text-lg font-semibold text-foreground">AI Research Brief</h3>
          </div>
          {brief && (
            <Badge variant="outline" className="text-muted-foreground" data-testid="badge-topic-version">
              Topic v{brief.topicVersion || topicVersion}
            </Badge>
          )}
        </div>
        
        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm mb-4 p-3 bg-destructive/10 rounded" data-testid="alert-error">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
        
        {isLive && !topicDeclarationId && (
          <div className="flex items-center gap-2 text-amber-500 text-sm mb-4 p-3 bg-amber-500/10 rounded" data-testid="alert-save-topic">
            <Info className="w-4 h-4 flex-shrink-0" />
            Save your topic declaration to enable AI-powered research brief generation
          </div>
        )}
        
        {!brief ? (
          <div className="text-center py-8" data-testid="container-empty-state">
            <p className="text-muted-foreground mb-4">
              Generate an AI-powered research brief with methodology suggestions
            </p>
            <Button 
              onClick={handleGenerate} 
              disabled={generating || !canGenerate}
              data-testid="button-generate-brief"
            >
              {generating ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Research Brief
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6" data-testid="container-brief-content">
            {brief.summary && (
              <div data-testid="section-summary">
                <p className="text-foreground/90 leading-relaxed">{brief.summary}</p>
              </div>
            )}
            
            {refinements?.confounders && refinements.confounders.length > 0 && (
              <div data-testid="section-confounders">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-500 mb-3">
                  <AlertTriangle className="w-4 h-4" />
                  Potential Confounders to Consider
                </h4>
                <div className="space-y-2">
                  {refinements.confounders.map((conf, idx) => (
                    <div key={idx} className="bg-background/50 rounded p-3 border border-border/50" data-testid={`confounder-${idx}`}>
                      <div className="flex justify-between items-start">
                        <span className="font-medium text-foreground">{conf.variable}</span>
                        <Badge 
                          variant={conf.priority === 'high' ? 'destructive' : 'secondary'}
                          className="text-xs"
                          data-testid={`badge-priority-${conf.priority}`}
                        >
                          {conf.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{conf.rationale}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {refinements?.biases && refinements.biases.length > 0 && (
              <div data-testid="section-biases">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-red-400 mb-3">
                  <AlertTriangle className="w-4 h-4" />
                  Potential Biases
                </h4>
                <div className="space-y-2">
                  {refinements.biases.map((bias, idx) => (
                    <div key={idx} className="bg-background/50 rounded p-3 border border-border/50" data-testid={`bias-${idx}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">{bias.type}</Badge>
                        <span className="text-foreground">{bias.description}</span>
                      </div>
                      <p className="text-sm text-green-500 mt-2">
                        <span className="font-medium">Mitigation:</span> {bias.mitigation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {refinements?.missingnessRisks && refinements.missingnessRisks.length > 0 && (
              <div data-testid="section-missingness">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-yellow-500 mb-3">
                  <Lightbulb className="w-4 h-4" />
                  Expected Missingness
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {refinements.missingnessRisks.map((risk, idx) => (
                    <div key={idx} className="bg-background/50 rounded p-3 border border-border/50" data-testid={`missingness-${idx}`}>
                      <div className="font-medium text-foreground">{risk.variable}</div>
                      <div className="text-sm text-yellow-500">~{risk.expectedRate}</div>
                      <div className="text-xs text-muted-foreground mt-1">{risk.strategy}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {refinements?.alternativeDesigns && refinements.alternativeDesigns.length > 0 && (
              <div data-testid="section-alternative-designs">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-blue-400 mb-3">
                  <GitBranch className="w-4 h-4" />
                  Alternative Study Designs
                </h4>
                <div className="space-y-2">
                  {refinements.alternativeDesigns.map((alt, idx) => (
                    <div key={idx} className="bg-background/50 rounded p-3 border border-border/50" data-testid={`alternative-${idx}`}>
                      <div className="font-medium text-foreground">{alt.design}</div>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                        <div className="text-green-500">+ {Array.isArray(alt.pros) ? alt.pros.join(', ') : alt.pros}</div>
                        <div className="text-red-400">- {Array.isArray(alt.cons) ? alt.cons.join(', ') : alt.cons}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="pt-4 border-t border-border" data-testid="section-regenerate">
              <Button 
                variant="outline" 
                onClick={handleGenerate}
                disabled={generating || !canGenerate}
                className="w-full"
                data-testid="button-regenerate-brief"
              >
                {generating ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  'Regenerate Brief for Current Topic'
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-2 text-center" data-testid="text-generation-info">
                Generated with {modelUsed} - Prompt v{promptVersion}
              </p>
            </div>
          </div>
        )}
      </Card>
    </DemoOverlay>
  );
}
