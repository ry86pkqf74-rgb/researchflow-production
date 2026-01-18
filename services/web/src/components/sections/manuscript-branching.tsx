import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { GitBranch, Plus, Share2, Calendar, Zap, FileText, BarChart3, FolderOpen, BookOpen } from "lucide-react";
import { motion } from "framer-motion";

interface ManuscriptBranch {
  id: number;
  title: string;
  status: "Draft" | "In Review" | "Submitted";
  progress: number;
  stage: string;
  lastModified: string;
  authors: number;
}

interface ManuscriptIsolatedState {
  journalSelection: string;
  statsOutputs: string[];
  exportFolder: string;
  analysisComplete: boolean;
}

const manuscripts: ManuscriptBranch[] = [
  {
    id: 0,
    title: "Thyroid-CV Study",
    status: "In Review",
    progress: 85,
    stage: "Statistical Analysis",
    lastModified: "2 hours ago",
    authors: 4
  },
  {
    id: 1,
    title: "ML Prediction Model",
    status: "Draft",
    progress: 60,
    stage: "Methods Development",
    lastModified: "Yesterday",
    authors: 3
  },
  {
    id: 2,
    title: "Gender Disparities Analysis",
    status: "Submitted",
    progress: 100,
    stage: "Publication",
    lastModified: "5 days ago",
    authors: 5
  }
];

function getStatusColor(status: string) {
  switch (status) {
    case "Submitted":
      return "bg-ros-success/10 text-ros-success border-ros-success/20";
    case "In Review":
      return "bg-ros-workflow/10 text-ros-workflow border-ros-workflow/20";
    case "Draft":
      return "bg-ros-primary/10 text-ros-primary border-ros-primary/20";
    default:
      return "bg-muted/50 text-muted-foreground";
  }
}

function getStatusIconColor(status: string) {
  switch (status) {
    case "Submitted":
      return "bg-ros-success/10 text-ros-success";
    case "In Review":
      return "bg-ros-workflow/10 text-ros-workflow";
    case "Draft":
      return "bg-ros-primary/10 text-ros-primary";
    default:
      return "bg-muted/50 text-muted-foreground";
  }
}

const JOURNAL_OPTIONS = [
  { value: "nejm", label: "New England Journal of Medicine" },
  { value: "lancet", label: "The Lancet" },
  { value: "jama", label: "JAMA" },
  { value: "bmj", label: "BMJ" },
  { value: "thyroid", label: "Thyroid" },
  { value: "jcem", label: "Journal of Clinical Endocrinology & Metabolism" },
];

const INITIAL_MANUSCRIPT_STATES: Record<number, ManuscriptIsolatedState> = {
  0: { 
    journalSelection: "thyroid", 
    statsOutputs: ["t-test", "linear-reg", "kaplan-meier"],
    exportFolder: "/exports/thyroid-cv-2024/",
    analysisComplete: true
  },
  1: { 
    journalSelection: "jcem", 
    statsOutputs: ["logistic-reg", "cox-reg"],
    exportFolder: "/exports/ml-prediction-2024/",
    analysisComplete: false
  },
  2: { 
    journalSelection: "lancet", 
    statsOutputs: ["chi-square", "mann-whitney", "anova-one"],
    exportFolder: "/exports/gender-disparities-2024/",
    analysisComplete: true
  },
};

export function ManuscriptBranching() {
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForComparison, setSelectedForComparison] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState("tab-0");
  
  // Per-manuscript isolated state - each tab maintains separate journal selection, stats outputs, and export folders
  const [manuscriptStates, setManuscriptStates] = useState<Record<number, ManuscriptIsolatedState>>(INITIAL_MANUSCRIPT_STATES);

  const toggleComparison = (id: number) => {
    setSelectedForComparison((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      } else if (prev.length < 2) {
        return [...prev, id];
      }
      return prev;
    });
  };

  const updateManuscriptState = useCallback((manuscriptId: number, updates: Partial<ManuscriptIsolatedState>) => {
    setManuscriptStates(prev => ({
      ...prev,
      [manuscriptId]: { ...prev[manuscriptId], ...updates }
    }));
  }, []);


  return (
    <section className="py-16 lg:py-24 bg-muted/30" data-testid="section-manuscript-branching">
      <div className="container mx-auto px-6 lg:px-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 lg:mb-16"
        >
          <Badge
            variant="secondary"
            className="mb-4 px-4 py-1.5 bg-ros-workflow/10 text-ros-workflow border-ros-workflow/20"
            data-testid="badge-manuscript-branching"
          >
            Multi-Manuscript Branching
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground mb-4" data-testid="text-manuscript-heading">
            Manage Multiple Research Directions
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-manuscript-description">
            Work on multiple manuscript branches simultaneously. Track progress, compare analyses, 
            and maintain different research directions from a single workspace.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8 flex items-center justify-between gap-4 flex-wrap"
        >
          <div className="flex items-center gap-3">
            <GitBranch className="h-5 w-5 text-ros-workflow" />
            <span className="text-sm font-medium text-muted-foreground">
              {manuscripts.length} Active Branches
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCompareMode(!compareMode)}
              className={compareMode ? "bg-ros-workflow/10 border-ros-workflow text-ros-workflow" : ""}
              data-testid="button-compare-view"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Compare View
            </Button>
            <Button
              size="sm"
              className="bg-ros-workflow text-white border-ros-workflow-border"
              data-testid="button-create-branch"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Branch
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {compareMode ? (
            <div className="grid lg:grid-cols-2 gap-6">
              {selectedForComparison.length > 0 ? (
                selectedForComparison.map((manuscriptId) => {
                  const manuscript = manuscripts[manuscriptId];
                  return (
                    <motion.div
                      key={manuscript.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card className="p-6 border-border/50 h-full" data-testid={`card-manuscript-comparison-${manuscript.id}`}>
                        <div className="space-y-6">
                          <div>
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <h3 className="text-lg font-semibold" data-testid={`text-manuscript-title-${manuscript.id}`}>
                                {manuscript.title}
                              </h3>
                              <Badge className={getStatusColor(manuscript.status)} data-testid={`badge-manuscript-status-${manuscript.id}`}>
                                {manuscript.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground" data-testid={`text-manuscript-authors-${manuscript.id}`}>
                              {manuscript.authors} collaborators
                            </p>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium" data-testid={`text-progress-label-${manuscript.id}`}>
                                  Progress
                                </span>
                                <span className="text-sm font-semibold text-ros-workflow" data-testid={`text-progress-percent-${manuscript.id}`}>
                                  {manuscript.progress}%
                                </span>
                              </div>
                              <Progress
                                value={manuscript.progress}
                                className="h-2 bg-muted"
                                data-testid={`progress-bar-${manuscript.id}`}
                              />
                            </div>

                            <div className="bg-muted/50 rounded-lg p-3" data-testid={`card-manuscript-details-${manuscript.id}`}>
                              <p className="text-xs font-medium text-muted-foreground mb-2">Current Stage</p>
                              <div className="flex items-center gap-2">
                                <Zap className="h-4 w-4 text-ros-workflow" />
                                <span className="text-sm font-medium" data-testid={`text-stage-${manuscript.id}`}>
                                  {manuscript.stage}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid={`modified-info-${manuscript.id}`}>
                              <Calendar className="h-3.5 w-3.5" />
                              <span>Last modified {manuscript.lastModified}</span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })
              ) : (
                <div className="lg:col-span-2">
                  <Card className="p-12 border-dashed border-2 border-border flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                      <Share2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                      <p className="text-muted-foreground mb-2">Select two manuscripts to compare</p>
                      <p className="text-xs text-muted-foreground/60">Click the checkboxes next to manuscript titles</p>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" data-testid="tabs-manuscripts">
              <TabsList className="grid w-full grid-cols-3 mb-8" data-testid="tablist-manuscripts">
                {manuscripts.map((manuscript, index) => (
                  <TabsTrigger
                    key={manuscript.id}
                    value={`tab-${index}`}
                    className="data-[state=active]:bg-ros-workflow data-[state=active]:text-white"
                    data-testid={`tab-manuscript-${index}`}
                  >
                    <span className="hidden sm:inline">{manuscript.title}</span>
                    <span className="sm:hidden">Branch {index + 1}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {manuscripts.map((manuscript, index) => (
                <TabsContent key={manuscript.id} value={`tab-${index}`} data-testid={`tabcontent-manuscript-${index}`}>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className="p-6 lg:p-8 border-border/50" data-testid={`card-manuscript-${index}`}>
                      <div className="grid lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1 space-y-6">
                          <div>
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <h3 className="text-2xl font-semibold" data-testid={`text-title-${index}`}>
                                {manuscript.title}
                              </h3>
                            </div>
                            <Badge className={getStatusColor(manuscript.status)} data-testid={`badge-status-${index}`}>
                              {manuscript.status}
                            </Badge>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2">Progress</p>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-ros-workflow" data-testid={`text-progress-value-${index}`}>
                                  {manuscript.progress}% Complete
                                </span>
                              </div>
                              <Progress value={manuscript.progress} className="h-2 bg-muted" data-testid={`progress-${index}`} />
                            </div>

                            <div className="bg-muted/50 rounded-lg p-4" data-testid={`card-stage-${index}`}>
                              <p className="text-xs font-medium text-muted-foreground mb-2">Current Workflow Stage</p>
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${getStatusIconColor(manuscript.status)}`} />
                                <span className="text-sm font-medium" data-testid={`text-stage-label-${index}`}>
                                  {manuscript.stage}
                                </span>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-border">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-muted-foreground">Collaborators</span>
                                <span className="text-sm font-semibold" data-testid={`text-authors-count-${index}`}>
                                  {manuscript.authors}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid={`modified-${index}`}>
                                <Calendar className="h-3.5 w-3.5" />
                                <span>Modified {manuscript.lastModified}</span>
                              </div>
                            </div>
                          </div>

                          {compareMode && (
                            <Button
                              variant={selectedForComparison.includes(manuscript.id) ? "default" : "outline"}
                              size="sm"
                              className={
                                selectedForComparison.includes(manuscript.id)
                                  ? "w-full bg-ros-workflow text-white"
                                  : "w-full"
                              }
                              onClick={() => toggleComparison(manuscript.id)}
                              data-testid={`button-select-comparison-${index}`}
                            >
                              {selectedForComparison.includes(manuscript.id) ? "Selected" : "Select for Compare"}
                            </Button>
                          )}
                        </div>

                        <div className="lg:col-span-2 space-y-6">
                          <div>
                            <h4 className="text-sm font-semibold mb-4" data-testid={`text-manuscript-summary-${index}`}>
                              Manuscript Summary
                            </h4>
                            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                              <div className="flex items-start gap-3 p-3 bg-card rounded-lg" data-testid={`summary-item-1-${index}`}>
                                <Zap className="h-4 w-4 text-ros-workflow flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground">Primary Analysis</p>
                                  <p className="text-sm font-medium mt-1">
                                    {manuscript.id === 0 && "Cardiovascular outcomes in thyroid disease"}
                                    {manuscript.id === 1 && "Machine learning classifier for risk prediction"}
                                    {manuscript.id === 2 && "Gender-specific treatment response patterns"}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-start gap-3 p-3 bg-card rounded-lg" data-testid={`summary-item-2-${index}`}>
                                <Zap className="h-4 w-4 text-ros-success flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground">Study Design</p>
                                  <p className="text-sm font-medium mt-1">
                                    {manuscript.id === 0 && "Retrospective cohort analysis"}
                                    {manuscript.id === 1 && "Prospective validation study"}
                                    {manuscript.id === 2 && "Stratified analysis by gender"}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-start gap-3 p-3 bg-card rounded-lg" data-testid={`summary-item-3-${index}`}>
                                <Zap className="h-4 w-4 text-ros-primary flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground">Patient Cohort</p>
                                  <p className="text-sm font-medium mt-1">
                                    {manuscript.id === 0 && "n = 2,847 patients (mean age 54.2)"}
                                    {manuscript.id === 1 && "n = 1,523 patients (training set)"}
                                    {manuscript.id === 2 && "n = 1,205 women, 1,642 men"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-sm font-semibold mb-4" data-testid={`text-milestones-${index}`}>
                              Recent Milestones
                            </h4>
                            <div className="space-y-2" data-testid={`list-milestones-${index}`}>
                              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg" data-testid={`milestone-1-${index}`}>
                                <div className="w-2 h-2 rounded-full bg-ros-success flex-shrink-0" />
                                <span className="text-sm">
                                  {manuscript.id === 0 && "Statistical analysis completed"}
                                  {manuscript.id === 1 && "Model training in progress"}
                                  {manuscript.id === 2 && "Journal acceptance received"}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg" data-testid={`milestone-2-${index}`}>
                                <div className="w-2 h-2 rounded-full bg-ros-workflow flex-shrink-0" />
                                <span className="text-sm">
                                  {manuscript.id === 0 && "Awaiting peer review feedback"}
                                  {manuscript.id === 1 && "Methods section drafted"}
                                  {manuscript.id === 2 && "Published online"}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg" data-testid={`milestone-3-${index}`}>
                                <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                                <span className="text-sm">
                                  {manuscript.id === 0 && "Next: Revise based on feedback"}
                                  {manuscript.id === 1 && "Next: Validation cohort analysis"}
                                  {manuscript.id === 2 && "Next: Supplementary data archival"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <Separator className="my-4" />

                          <div className="space-y-4" data-testid={`isolated-state-${index}`}>
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                              <FileText className="h-4 w-4 text-ros-primary" />
                              Isolated Manuscript Settings
                            </h4>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                  <BookOpen className="h-3 w-3" />
                                  Target Journal
                                </label>
                                <Select 
                                  value={manuscriptStates[manuscript.id]?.journalSelection || ""}
                                  onValueChange={(value) => updateManuscriptState(manuscript.id, { journalSelection: value })}
                                >
                                  <SelectTrigger className="w-full" data-testid={`select-journal-${index}`}>
                                    <SelectValue placeholder="Select journal" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {JOURNAL_OPTIONS.map(journal => (
                                      <SelectItem key={journal.value} value={journal.value}>
                                        {journal.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                  <FolderOpen className="h-3 w-3" />
                                  Export Folder
                                </label>
                                <div className="p-2 bg-muted/50 rounded-md border">
                                  <code className="text-xs font-mono" data-testid={`text-export-folder-${index}`}>
                                    {manuscriptStates[manuscript.id]?.exportFolder || "/exports/"}
                                  </code>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <BarChart3 className="h-3 w-3" />
                                Statistical Outputs ({manuscriptStates[manuscript.id]?.statsOutputs?.length || 0} tests)
                              </label>
                              <div className="flex flex-wrap gap-1" data-testid={`stats-outputs-${index}`}>
                                {(manuscriptStates[manuscript.id]?.statsOutputs || []).map((test, i) => (
                                  <Badge 
                                    key={i} 
                                    variant="secondary" 
                                    className="text-xs"
                                    data-testid={`stat-output-${index}-${i}`}
                                  >
                                    {test}
                                  </Badge>
                                ))}
                                {manuscriptStates[manuscript.id]?.analysisComplete && (
                                  <Badge className="bg-ros-success/10 text-ros-success border-ros-success/30 text-xs">
                                    Analysis Complete
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12"
        >
          <Card className="p-8 border-ros-workflow/20 bg-ros-workflow/5" data-testid="card-branching-benefits">
            <div className="grid md:grid-cols-3 gap-8">
              <div data-testid="benefit-1">
                <div className="w-12 h-12 rounded-lg bg-ros-workflow/10 text-ros-workflow flex items-center justify-center mb-4">
                  <GitBranch className="h-6 w-6" />
                </div>
                <h3 className="font-semibold mb-2" data-testid="text-benefit-1-title">
                  Independent Workflows
                </h3>
                <p className="text-sm text-muted-foreground" data-testid="text-benefit-1-desc">
                  Each branch maintains its own analysis pipeline, allowing parallel research directions without conflicts.
                </p>
              </div>

              <div data-testid="benefit-2">
                <div className="w-12 h-12 rounded-lg bg-ros-success/10 text-ros-success flex items-center justify-center mb-4">
                  <Share2 className="h-6 w-6" />
                </div>
                <h3 className="font-semibold mb-2" data-testid="text-benefit-2-title">
                  Easy Comparison
                </h3>
                <p className="text-sm text-muted-foreground" data-testid="text-benefit-2-desc">
                  Side-by-side manuscript analysis to compare methodologies, results, and publication potential.
                </p>
              </div>

              <div data-testid="benefit-3">
                <div className="w-12 h-12 rounded-lg bg-ros-primary/10 text-ros-primary flex items-center justify-center mb-4">
                  <Plus className="h-6 w-6" />
                </div>
                <h3 className="font-semibold mb-2" data-testid="text-benefit-3-title">
                  Rapid Ideation
                </h3>
                <p className="text-sm text-muted-foreground" data-testid="text-benefit-3-desc">
                  Quickly create and test new research directions without impacting your primary manuscript.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
