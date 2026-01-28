/**
 * Enhanced IRB Form Page
 *
 * Main page for creating IRB applications with institution-specific templates.
 * Integrates all IRB components: institution selection, lay summary, vulnerable
 * populations, and AI/ML disclosure.
 */

import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  AlertCircle,
  FileText,
  Building2,
  Users,
  Sparkles,
  Save,
  Send,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Shield,
} from "lucide-react";

import {
  InstitutionSelector,
  LaySummaryEditor,
  VulnerablePopulationsSection,
  AIMLDisclosure,
} from "../components";

interface IRBDraft {
  id?: string;
  institution_id: string;
  study_title: string;
  study_type: "chart_review" | "secondary_use" | "prospective" | "interventional" | "observational";
  principal_investigator: string;
  lay_summary: string;
  vulnerable_populations: string[];
  ai_ml_usage: {
    uses_ai_ml: boolean;
    ai_ml_purposes: string[];
    model_types: string[];
    training_data_description: string;
    bias_mitigation: string;
    human_oversight: string;
    transparency_measures: string;
    data_retention: string;
    model_names?: string[];
    vendor_names?: string[];
    consent_language_included: boolean;
  };
  research_objectives: string;
  methodology: string;
  data_sources: string;
  status: "draft" | "submitted" | "in_review" | "approved" | "revision_requested";
}

interface ValidationSummary {
  institution_selected: boolean;
  title_provided: boolean;
  lay_summary_valid: boolean;
  vulnerable_populations_addressed: boolean;
  ai_ml_disclosed: boolean;
  overall_completeness: number;
}

const STUDY_TYPES = [
  { id: "chart_review", label: "Chart Review", description: "Review of existing medical records" },
  { id: "secondary_use", label: "Secondary Data Use", description: "Analysis of existing datasets" },
  { id: "prospective", label: "Prospective Study", description: "Data collected going forward" },
  { id: "interventional", label: "Interventional", description: "Testing an intervention" },
  { id: "observational", label: "Observational", description: "Observing without intervention" },
];

const TABS = [
  { id: "institution", label: "Institution", icon: Building2 },
  { id: "basic", label: "Basic Info", icon: FileText },
  { id: "lay-summary", label: "Lay Summary", icon: ClipboardCheck },
  { id: "populations", label: "Populations", icon: Users },
  { id: "ai-ml", label: "AI/ML", icon: Sparkles },
  { id: "review", label: "Review", icon: Shield },
];

const initialDraft: IRBDraft = {
  institution_id: "",
  study_title: "",
  study_type: "prospective",
  principal_investigator: "",
  lay_summary: "",
  vulnerable_populations: [],
  ai_ml_usage: {
    uses_ai_ml: false,
    ai_ml_purposes: [],
    model_types: [],
    training_data_description: "",
    bias_mitigation: "",
    human_oversight: "",
    transparency_measures: "",
    data_retention: "",
    consent_language_included: false,
  },
  research_objectives: "",
  methodology: "",
  data_sources: "",
  status: "draft",
};

export function EnhancedIRBForm() {
  const [draft, setDraft] = useState<IRBDraft>(initialDraft);
  const [activeTab, setActiveTab] = useState("institution");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Save draft mutation
  const saveDraftMutation = useMutation({
    mutationFn: async (draftData: IRBDraft) => {
      const res = await fetch("/api/irb/drafts", {
        method: draftData.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftData),
      });
      if (!res.ok) throw new Error("Failed to save draft");
      return res.json();
    },
    onSuccess: (data) => {
      setDraft((prev) => ({ ...prev, id: data.id }));
      setLastSaved(new Date());
    },
  });

  // Submit for review mutation
  const submitMutation = useMutation({
    mutationFn: async (draftId: string) => {
      const res = await fetch(`/api/irb/drafts/${draftId}/submit`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to submit");
      return res.json();
    },
    onSuccess: () => {
      setDraft((prev) => ({ ...prev, status: "submitted" }));
    },
  });

  // Calculate validation summary
  const getValidationSummary = useCallback((): ValidationSummary => {
    const laySummaryWordCount = draft.lay_summary.trim().split(/\s+/).filter(Boolean).length;

    return {
      institution_selected: !!draft.institution_id,
      title_provided: draft.study_title.trim().length > 10,
      lay_summary_valid: laySummaryWordCount >= 100 && laySummaryWordCount <= 500,
      vulnerable_populations_addressed: true, // Can be empty if no vulnerable populations
      ai_ml_disclosed: !draft.ai_ml_usage.uses_ai_ml || (
        draft.ai_ml_usage.ai_ml_purposes.length > 0 &&
        draft.ai_ml_usage.human_oversight.length > 20
      ),
      overall_completeness: 0, // Calculated below
    };
  }, [draft]);

  const validation = getValidationSummary();
  const completedSteps = [
    validation.institution_selected,
    validation.title_provided,
    validation.lay_summary_valid,
    validation.vulnerable_populations_addressed,
    validation.ai_ml_disclosed,
  ].filter(Boolean).length;
  validation.overall_completeness = Math.round((completedSteps / 5) * 100);

  const handleSaveDraft = () => {
    saveDraftMutation.mutate(draft);
  };

  const handleSubmit = () => {
    if (draft.id) {
      submitMutation.mutate(draft.id);
    }
  };

  const goToNextTab = () => {
    const currentIndex = TABS.findIndex((t) => t.id === activeTab);
    if (currentIndex < TABS.length - 1) {
      setActiveTab(TABS[currentIndex + 1].id);
    }
  };

  const goToPrevTab = () => {
    const currentIndex = TABS.findIndex((t) => t.id === activeTab);
    if (currentIndex > 0) {
      setActiveTab(TABS[currentIndex - 1].id);
    }
  };

  const currentTabIndex = TABS.findIndex((t) => t.id === activeTab);

  return (
    <div className="container max-w-4xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Enhanced IRB Application</h1>
          <p className="text-muted-foreground">
            Create an IRB application with institution-specific templates
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastSaved && (
            <span className="text-xs text-muted-foreground">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={saveDraftMutation.isPending}
          >
            {saveDraftMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Draft
          </Button>
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Application Progress</span>
            <Badge variant={validation.overall_completeness === 100 ? "default" : "outline"}>
              {validation.overall_completeness}% Complete
            </Badge>
          </div>
          <Progress value={validation.overall_completeness} className="h-2" />
        </CardContent>
      </Card>

      {/* Main Form Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-6 w-full">
          {TABS.map((tab, index) => {
            const Icon = tab.icon;
            const isComplete = index === 0 ? validation.institution_selected :
                              index === 1 ? validation.title_provided :
                              index === 2 ? validation.lay_summary_valid :
                              index === 3 ? validation.vulnerable_populations_addressed :
                              index === 4 ? validation.ai_ml_disclosed :
                              validation.overall_completeness === 100;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-1.5 text-xs"
              >
                {isComplete ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Institution Tab */}
        <TabsContent value="institution" className="space-y-4">
          <InstitutionSelector
            selectedInstitution={draft.institution_id}
            onSelect={(id) => setDraft((prev) => ({ ...prev, institution_id: id }))}
          />
        </TabsContent>

        {/* Basic Info Tab */}
        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Study Information</CardTitle>
              <CardDescription>
                Provide basic information about your research study.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="study-title">Study Title</Label>
                <Input
                  id="study-title"
                  placeholder="Enter the full title of your research study"
                  value={draft.study_title}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, study_title: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pi">Principal Investigator</Label>
                <Input
                  id="pi"
                  placeholder="Name of the principal investigator"
                  value={draft.principal_investigator}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, principal_investigator: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Study Type</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {STUDY_TYPES.map((type) => (
                    <Card
                      key={type.id}
                      className={`cursor-pointer transition-colors ${
                        draft.study_type === type.id
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/50"
                      }`}
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          study_type: type.id as IRBDraft["study_type"],
                        }))
                      }
                    >
                      <CardContent className="p-3">
                        <p className="font-medium text-sm">{type.label}</p>
                        <p className="text-xs text-muted-foreground">{type.description}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="objectives">Research Objectives</Label>
                <Textarea
                  id="objectives"
                  placeholder="Describe the primary objectives of your research..."
                  value={draft.research_objectives}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, research_objectives: e.target.value }))
                  }
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="methodology">Methodology</Label>
                <Textarea
                  id="methodology"
                  placeholder="Describe your research methodology..."
                  value={draft.methodology}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, methodology: e.target.value }))
                  }
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="data-sources">Data Sources</Label>
                <Textarea
                  id="data-sources"
                  placeholder="Describe the data sources you will use..."
                  value={draft.data_sources}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, data_sources: e.target.value }))
                  }
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lay Summary Tab */}
        <TabsContent value="lay-summary" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <LaySummaryEditor
                value={draft.lay_summary}
                onChange={(value) => setDraft((prev) => ({ ...prev, lay_summary: value }))}
                institutionId={draft.institution_id || "generic"}
                studyType={draft.study_type}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vulnerable Populations Tab */}
        <TabsContent value="populations" className="space-y-4">
          <VulnerablePopulationsSection
            selectedPopulations={draft.vulnerable_populations}
            onSelectionChange={(populations) =>
              setDraft((prev) => ({ ...prev, vulnerable_populations: populations }))
            }
            institutionId={draft.institution_id || "generic"}
          />
        </TabsContent>

        {/* AI/ML Tab */}
        <TabsContent value="ai-ml" className="space-y-4">
          <AIMLDisclosure
            value={draft.ai_ml_usage}
            onChange={(value) => setDraft((prev) => ({ ...prev, ai_ml_usage: value }))}
            institutionId={draft.institution_id || "generic"}
          />
        </TabsContent>

        {/* Review Tab */}
        <TabsContent value="review" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Application Review
              </CardTitle>
              <CardDescription>
                Review your application before submission.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Validation Checklist */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Completion Checklist</h4>
                {[
                  { key: "institution_selected", label: "Institution selected" },
                  { key: "title_provided", label: "Study title provided" },
                  { key: "lay_summary_valid", label: "Lay summary complete (100-500 words)" },
                  { key: "vulnerable_populations_addressed", label: "Vulnerable populations addressed" },
                  { key: "ai_ml_disclosed", label: "AI/ML usage disclosed" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center gap-2">
                    {validation[item.key as keyof ValidationSummary] ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    )}
                    <span
                      className={
                        validation[item.key as keyof ValidationSummary]
                          ? "text-green-700 dark:text-green-400"
                          : "text-amber-700 dark:text-amber-400"
                      }
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Summary */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Application Summary</h4>
                <div className="grid gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Institution:</span>{" "}
                    <span className="font-medium">{draft.institution_id || "Not selected"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Study Title:</span>{" "}
                    <span className="font-medium">{draft.study_title || "Not provided"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Study Type:</span>{" "}
                    <span className="font-medium capitalize">{draft.study_type.replace(/_/g, " ")}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">PI:</span>{" "}
                    <span className="font-medium">{draft.principal_investigator || "Not provided"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Vulnerable Populations:</span>{" "}
                    <span className="font-medium">
                      {draft.vulnerable_populations.length > 0
                        ? draft.vulnerable_populations.join(", ")
                        : "None"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Uses AI/ML:</span>{" "}
                    <span className="font-medium">{draft.ai_ml_usage.uses_ai_ml ? "Yes" : "No"}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Submit */}
              {validation.overall_completeness < 100 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Application Incomplete</AlertTitle>
                  <AlertDescription>
                    Please complete all required sections before submitting.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="bg-green-500/10 border-green-500/20">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-700 dark:text-green-400">
                    Ready for Submission
                  </AlertTitle>
                  <AlertDescription className="text-green-600 dark:text-green-400">
                    Your application is complete and ready for IRB review.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <Button
          variant="outline"
          onClick={goToPrevTab}
          disabled={currentTabIndex === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>

        <div className="flex gap-2">
          {activeTab === "review" ? (
            <Button
              onClick={handleSubmit}
              disabled={
                validation.overall_completeness < 100 ||
                submitMutation.isPending ||
                !draft.id
              }
            >
              {submitMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit for Review
            </Button>
          ) : (
            <Button onClick={goToNextTab} disabled={currentTabIndex === TABS.length - 1}>
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default EnhancedIRBForm;
