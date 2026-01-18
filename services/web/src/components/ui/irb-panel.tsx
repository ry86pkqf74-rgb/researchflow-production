import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FatiguePolicyBanner } from "@/components/ui/fatigue-policy-banner";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Download, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  FileType, 
  FileDown,
  Loader2,
  Shield,
  Clock,
  List,
  HelpCircle,
  RefreshCw,
  Sparkles,
  ChevronDown,
  WifiOff
} from "lucide-react";

interface IRBQuestion {
  category: string;
  title: string;
  prompt: string;
  guidance: string[];
}

interface IRBDraft {
  path: string;
  filename: string;
  study_title: string;
  created_at: string;
}

interface DependencyStatus {
  docx_available: boolean;
  pdf_available: boolean;
  all_available: boolean;
  install_hint: string | null;
}

interface IRBPanelProps {
  researchQuestion?: string;
  studyTitle?: string;
}

interface SystemStatus {
  status: string;
  mode: string;
  mock_only: boolean;
  no_network: boolean;
}

export function IrbPanel({ researchQuestion = "", studyTitle = "Untitled Study" }: IRBPanelProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("form");
  const [questions, setQuestions] = useState<IRBQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [title, setTitle] = useState(studyTitle);
  const [question, setQuestion] = useState(researchQuestion);
  const [literatureQuery, setLiteratureQuery] = useState("");
  const [aiLiteratureQuery, setAiLiteratureQuery] = useState("");
  const [drafts, setDrafts] = useState<IRBDraft[]>([]);
  const [dependencies, setDependencies] = useState<DependencyStatus | null>(null);
  const [irbStatus, setIrbStatus] = useState({ submitted: false, draftCount: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState<"pdf" | "docx" | null>(null);
  const [generatedMarkdown, setGeneratedMarkdown] = useState("");
  const [redactPhi, setRedactPhi] = useState(true);
  const [aiAssistEnabled, setAiAssistEnabled] = useState(false);
  const [aiAssistOpen, setAiAssistOpen] = useState(false);
  const [isGeneratingAiDraft, setIsGeneratingAiDraft] = useState(false);

  const { data: systemStatus } = useQuery<SystemStatus>({
    queryKey: ["/api/ros/status"],
    staleTime: 30000,
  });

  const isStandbyMode = systemStatus?.mock_only || systemStatus?.no_network || false;

  useEffect(() => {
    fetchQuestions();
    fetchDependencies();
    fetchDrafts();
    fetchIrbStatus();
  }, []);

  const handleAiAutoDraft = async () => {
    if (isStandbyMode) return;
    
    setIsGeneratingAiDraft(true);
    try {
      const res = await fetch("/api/ros/irb/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          study_title: title,
          research_question: question,
          answers,
          literature_query: aiLiteratureQuery || null
        })
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        if (data.research_question) {
          setQuestion(data.research_question);
        }
        toast({
          title: "AI Draft Generated",
          description: "Research question has been auto-populated from literature.",
        });
      } else {
        throw new Error(data.detail || "Failed to generate AI draft");
      }
    } catch (error) {
      toast({
        title: "AI Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate AI draft",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingAiDraft(false);
    }
  };

  const fetchQuestions = async () => {
    try {
      const res = await fetch("/api/ros/irb/questions");
      const data = await res.json();
      if (data.status === "success" && data.questions) {
        setQuestions(data.questions);
      }
    } catch (error) {
      console.error("Failed to fetch IRB questions:", error);
    }
  };

  const fetchDependencies = async () => {
    try {
      const res = await fetch("/api/ros/irb/dependencies");
      const data = await res.json();
      if (data.status === "success") {
        setDependencies(data);
      }
    } catch (error) {
      console.error("Failed to check dependencies:", error);
    }
  };

  const fetchDrafts = async () => {
    try {
      const res = await fetch("/api/ros/irb/drafts");
      const data = await res.json();
      if (data.status === "success") {
        setDrafts(data.drafts);
      }
    } catch (error) {
      console.error("Failed to fetch drafts:", error);
    }
  };

  const fetchIrbStatus = async () => {
    try {
      const res = await fetch("/api/ros/irb/status");
      const data = await res.json();
      if (data.status === "success") {
        setIrbStatus({
          submitted: data.irb_submitted,
          draftCount: data.draft_count
        });
      }
    } catch (error) {
      console.error("Failed to fetch IRB status:", error);
    }
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/ros/irb/draft/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          study_title: title,
          research_question: question,
          answers,
          literature_query: literatureQuery || null
        })
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setGeneratedMarkdown(data.draft_markdown);
        toast({
          title: "Draft Saved",
          description: "IRB draft saved successfully with PHI protection.",
        });
        fetchDrafts();
        fetchIrbStatus();
        setActiveTab("preview");
      } else {
        throw new Error(data.detail || "Failed to save draft");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save draft",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async (format: "pdf" | "docx") => {
    if (!dependencies) return;
    
    if (format === "pdf" && !dependencies.pdf_available) {
      toast({
        title: "PDF Export Unavailable",
        description: "The reportlab package is not installed.",
        variant: "destructive"
      });
      return;
    }
    
    if (format === "docx" && !dependencies.docx_available) {
      toast({
        title: "DOCX Export Unavailable", 
        description: "The python-docx package is not installed.",
        variant: "destructive"
      });
      return;
    }

    setIsExporting(format);
    try {
      const res = await fetch(`/api/ros/irb/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          study_title: title,
          research_question: question,
          answers,
          literature_query: literatureQuery || null,
          redact_phi: redactPhi
        })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || `Failed to export ${format.toUpperCase()}`);
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `irb_draft.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export Complete",
        description: `IRB draft exported as ${format.toUpperCase()}.`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : `Failed to export ${format}`,
        variant: "destructive"
      });
    } finally {
      setIsExporting(null);
    }
  };

  const handleMarkSubmitted = async () => {
    try {
      const res = await fetch("/api/ros/irb/mark-submitted", { method: "POST" });
      const data = await res.json();
      if (data.status === "success") {
        setIrbStatus(prev => ({ ...prev, submitted: true }));
        toast({
          title: "IRB Marked as Submitted",
          description: "This is a compliance attestation that IRB review has been completed.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to mark IRB as submitted",
        variant: "destructive"
      });
    }
  };

  const completedQuestions = Object.keys(answers).filter(k => answers[k]?.trim()).length;
  const totalQuestions = questions.length;
  const progressPercent = totalQuestions > 0 ? Math.round((completedQuestions / totalQuestions) * 100) : 0;

  return (
    <Card className="border-ros-primary/20" data-testid="card-irb-panel">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-ros-primary/10">
              <FileText className="h-5 w-5 text-ros-primary" />
            </div>
            <div>
              <CardTitle className="text-lg" data-testid="text-irb-title">IRB Proposal Builder</CardTitle>
              <p className="text-sm text-muted-foreground">Generate and export IRB documents</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {irbStatus.submitted ? (
              <Badge className="bg-ros-success/10 text-ros-success border-ros-success/20" data-testid="badge-irb-submitted">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Submitted
              </Badge>
            ) : (
              <Badge variant="secondary" data-testid="badge-irb-draft">
                <Clock className="h-3 w-3 mr-1" />
                Draft
              </Badge>
            )}
            <Badge variant="outline" data-testid="badge-draft-count">
              {irbStatus.draftCount} saved
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="form" data-testid="tab-irb-form">
              <FileText className="h-4 w-4 mr-1" />
              Form
            </TabsTrigger>
            <TabsTrigger value="questions" data-testid="tab-irb-questions">
              <List className="h-4 w-4 mr-1" />
              Questions
            </TabsTrigger>
            <TabsTrigger value="drafts" data-testid="tab-irb-drafts">
              <Save className="h-4 w-4 mr-1" />
              Drafts
            </TabsTrigger>
            <TabsTrigger value="preview" data-testid="tab-irb-preview">
              <FileDown className="h-4 w-4 mr-1" />
              Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="form" className="space-y-4 mt-4">
            <FatiguePolicyBanner variant="compact" showLearnMore={false} />
            <Collapsible open={aiAssistOpen} onOpenChange={setAiAssistOpen}>
              <div className="rounded-lg border bg-muted/30 p-3">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-ros-primary" />
                      <span className="font-medium text-sm">AI-Assisted Draft (Optional)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Switch
                          id="ai-assist-toggle"
                          checked={aiAssistEnabled}
                          onCheckedChange={(checked) => {
                            setAiAssistEnabled(checked);
                            if (checked) setAiAssistOpen(true);
                          }}
                          disabled={isStandbyMode}
                          data-testid="toggle-ai-assist"
                        />
                        <Label htmlFor="ai-assist-toggle" className="text-xs text-muted-foreground">
                          {aiAssistEnabled ? "Enabled" : "Disabled"}
                        </Label>
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${aiAssistOpen ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-3">
                  {isStandbyMode && (
                    <Alert variant="destructive" className="bg-amber-500/10 border-amber-500/30" data-testid="alert-standby-mode">
                      <WifiOff className="h-4 w-4" />
                      <AlertDescription>
                        AI features are limited in STANDBY mode. Network access is disabled.
                      </AlertDescription>
                    </Alert>
                  )}
                  {aiAssistEnabled && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="ai-lit-query" className="text-sm">Literature Search Query</Label>
                        <Input
                          id="ai-lit-query"
                          value={aiLiteratureQuery}
                          onChange={(e) => setAiLiteratureQuery(e.target.value)}
                          placeholder="e.g., thyroid dysfunction cardiovascular risk"
                          disabled={isStandbyMode}
                          data-testid="input-literature-query"
                        />
                        <p className="text-xs text-muted-foreground">
                          Enter keywords to search literature and auto-generate research question context.
                        </p>
                      </div>
                      <Button
                        onClick={handleAiAutoDraft}
                        disabled={isStandbyMode || isGeneratingAiDraft || !aiLiteratureQuery.trim()}
                        size="sm"
                        data-testid="button-auto-draft"
                      >
                        {isGeneratingAiDraft ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        Auto-Draft with Literature
                      </Button>
                    </div>
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="study-title">Study Title</Label>
                <Input
                  id="study-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter study title..."
                  data-testid="input-study-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="research-question">Research Question</Label>
                <Textarea
                  id="research-question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Describe your research question..."
                  rows={3}
                  data-testid="input-research-question"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lit-query">Literature Search Query (Optional)</Label>
                <Input
                  id="lit-query"
                  value={literatureQuery}
                  onChange={(e) => setLiteratureQuery(e.target.value)}
                  placeholder="e.g., thyroid cardiovascular outcomes"
                  data-testid="input-form-literature-query"
                />
                <p className="text-xs text-muted-foreground">Used to auto-populate context from related studies</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Questions Completed</span>
                <span className="font-medium">{completedQuestions} / {totalQuestions}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-ros-primary h-2 rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="redact-phi" 
                  checked={redactPhi} 
                  onCheckedChange={(c) => setRedactPhi(c === true)}
                  data-testid="checkbox-redact-phi"
                />
                <Label htmlFor="redact-phi" className="text-sm flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  Redact PHI in exports
                </Label>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button 
                onClick={handleSaveDraft} 
                disabled={isSaving || !title.trim()}
                data-testid="button-save-draft"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Draft
              </Button>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button 
                      variant="outline"
                      onClick={() => handleExport("docx")}
                      disabled={isExporting !== null || !dependencies?.docx_available}
                      data-testid="button-export-docx"
                    >
                      {isExporting === "docx" ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FileType className="h-4 w-4 mr-2" />
                      )}
                      Export DOCX
                    </Button>
                  </span>
                </TooltipTrigger>
                {!dependencies?.docx_available && (
                  <TooltipContent>
                    <p>python-docx package not installed</p>
                  </TooltipContent>
                )}
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button 
                      variant="outline"
                      onClick={() => handleExport("pdf")}
                      disabled={isExporting !== null || !dependencies?.pdf_available}
                      data-testid="button-export-pdf"
                    >
                      {isExporting === "pdf" ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Export PDF
                    </Button>
                  </span>
                </TooltipTrigger>
                {!dependencies?.pdf_available && (
                  <TooltipContent>
                    <p>reportlab package not installed</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </div>

            {!dependencies?.all_available && dependencies?.install_hint && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-700 dark:text-amber-400">Some export features unavailable</p>
                    <p className="text-muted-foreground">{dependencies.install_hint}</p>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="questions" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {questions.map((q, idx) => (
                  <div key={q.category} className="p-4 rounded-lg border bg-card">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{idx + 1}</Badge>
                        <h4 className="font-medium">{q.title}</h4>
                      </div>
                      {answers[q.category]?.trim() && (
                        <CheckCircle2 className="h-4 w-4 text-ros-success" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{q.prompt}</p>
                    {q.guidance.length > 0 && (
                      <div className="mb-3 p-2 rounded bg-muted/50 text-xs">
                        <div className="flex items-center gap-1 text-muted-foreground mb-1">
                          <HelpCircle className="h-3 w-3" />
                          <span>Guidance:</span>
                        </div>
                        <ul className="list-disc list-inside space-y-0.5">
                          {q.guidance.map((g, i) => (
                            <li key={i}>{g}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <Textarea
                      value={answers[q.category] || ""}
                      onChange={(e) => setAnswers(prev => ({ ...prev, [q.category]: e.target.value }))}
                      placeholder="Enter your response..."
                      rows={3}
                      data-testid={`textarea-question-${q.category}`}
                    />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="drafts" className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Saved Drafts</h4>
              <Button variant="ghost" size="sm" onClick={fetchDrafts} data-testid="button-refresh-drafts">
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
            {drafts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Save className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No saved drafts yet</p>
                <p className="text-sm">Save a draft to see it here</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {drafts.map((draft) => (
                    <div 
                      key={draft.path} 
                      className="p-3 rounded-lg border bg-card hover-elevate cursor-pointer"
                      data-testid={`draft-item-${draft.filename}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{draft.study_title}</p>
                          <p className="text-xs text-muted-foreground">{draft.filename}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {new Date(draft.created_at).toLocaleDateString()}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">IRB Submission Status</p>
                  <p className="text-xs text-muted-foreground">
                    Mark as submitted after institutional review
                  </p>
                </div>
                <Button 
                  variant={irbStatus.submitted ? "secondary" : "default"}
                  size="sm"
                  onClick={handleMarkSubmitted}
                  disabled={irbStatus.submitted}
                  data-testid="button-mark-submitted"
                >
                  {irbStatus.submitted ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Submitted
                    </>
                  ) : (
                    "Mark IRB Submitted"
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            {generatedMarkdown ? (
              <ScrollArea className="h-[400px]">
                <div className="prose prose-sm dark:prose-invert max-w-none p-4 bg-muted/30 rounded-lg">
                  <pre className="whitespace-pre-wrap text-sm font-mono">{generatedMarkdown}</pre>
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileDown className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No preview available</p>
                <p className="text-sm">Save a draft to see the generated IRB document</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
