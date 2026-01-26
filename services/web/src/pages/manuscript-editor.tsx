/**
 * Manuscript Editor Page
 *
 * Full-featured manuscript editing with:
 * - Rich text editing (TipTap-like experience)
 * - IMRaD section structure
 * - AI-powered section generation
 * - Real-time collaboration (Yjs integration ready)
 * - Word budget validation
 */

import { useState, useCallback, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileText,
  Sparkles,
  Save,
  GitBranch,
  Plus,
  Download,
  Loader2,
  AlertTriangle,
  CheckCircle,
  BookOpen,
  BarChart3,
  MessageSquare,
  Microscope,
  Target,
  ChevronLeft,
  Copy,
  RefreshCw,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AIApprovalGate, useAIApprovalGate } from "@/components/ui/ai-approval-gate";

// ============================================================================
// Types
// ============================================================================

interface ManuscriptSection {
  id: string;
  name: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  content: string;
  wordCount: number;
  minWords: number;
  maxWords: number;
  isValid: boolean;
  lastGenerated?: string;
}

interface ManuscriptData {
  id: string;
  title: string;
  branchName: string;
  status: "draft" | "review" | "approved";
  sections: ManuscriptSection[];
  targetJournal?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Constants
// ============================================================================

const SECTION_TEMPLATES: Omit<ManuscriptSection, "content" | "wordCount" | "isValid" | "lastGenerated">[] = [
  {
    id: "introduction",
    name: "introduction",
    label: "Introduction",
    icon: BookOpen,
    minWords: 400,
    maxWords: 800,
  },
  {
    id: "methods",
    name: "methods",
    label: "Methods",
    icon: Microscope,
    minWords: 800,
    maxWords: 1500,
  },
  {
    id: "results",
    name: "results",
    label: "Results",
    icon: BarChart3,
    minWords: 600,
    maxWords: 1200,
  },
  {
    id: "discussion",
    name: "discussion",
    label: "Discussion",
    icon: MessageSquare,
    minWords: 800,
    maxWords: 1500,
  },
  {
    id: "conclusion",
    name: "conclusion",
    label: "Conclusion",
    icon: Target,
    minWords: 150,
    maxWords: 300,
  },
];

const JOURNAL_OPTIONS = [
  { value: "nejm", label: "New England Journal of Medicine", wordLimit: 2500 },
  { value: "lancet", label: "The Lancet", wordLimit: 3000 },
  { value: "jama", label: "JAMA", wordLimit: 3000 },
  { value: "bmj", label: "BMJ", wordLimit: 4000 },
  { value: "thyroid", label: "Thyroid", wordLimit: 4500 },
  { value: "jcem", label: "J Clin Endocrinol Metab", wordLimit: 4000 },
  { value: "plos-one", label: "PLOS ONE", wordLimit: 6000 },
];

// ============================================================================
// Helper Functions
// ============================================================================

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function getWordCountStatus(wordCount: number, min: number, max: number): "under" | "valid" | "over" {
  if (wordCount < min) return "under";
  if (wordCount > max) return "over";
  return "valid";
}

// ============================================================================
// Components
// ============================================================================

function SectionEditor({
  section,
  onContentChange,
  onGenerate,
  isGenerating,
}: {
  section: ManuscriptSection;
  onContentChange: (content: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  const wordStatus = getWordCountStatus(section.wordCount, section.minWords, section.maxWords);
  const Icon = section.icon;

  return (
    <div className="space-y-4" data-testid={`section-editor-${section.id}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-ros-primary" />
          <h3 className="font-semibold">{section.label}</h3>
          <Badge
            variant="outline"
            className={
              wordStatus === "valid"
                ? "bg-ros-success/10 text-ros-success border-ros-success/30"
                : wordStatus === "over"
                ? "bg-ros-alert/10 text-ros-alert border-ros-alert/30"
                : "bg-amber-500/10 text-amber-600 border-amber-500/30"
            }
          >
            {section.wordCount} / {section.minWords}-{section.maxWords} words
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onGenerate}
          disabled={isGenerating}
          data-testid={`button-generate-${section.id}`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              AI Generate
            </>
          )}
        </Button>
      </div>

      <div className="relative">
        <Textarea
          value={section.content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder={`Write your ${section.label.toLowerCase()} section here...`}
          className="min-h-[300px] font-serif text-base leading-relaxed resize-y"
          data-testid={`textarea-${section.id}`}
        />
        {section.lastGenerated && (
          <div className="absolute bottom-2 right-2 text-xs text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            AI generated
          </div>
        )}
      </div>

      <Progress
        value={Math.min((section.wordCount / section.maxWords) * 100, 100)}
        className={`h-1 ${
          wordStatus === "over" ? "[&>div]:bg-ros-alert" : wordStatus === "valid" ? "[&>div]:bg-ros-success" : ""
        }`}
      />
    </div>
  );
}

function ManuscriptSidebar({
  sections,
  activeSection,
  onSectionSelect,
  targetJournal,
  onJournalChange,
  onSave,
  onExport,
  isSaving,
}: {
  sections: ManuscriptSection[];
  activeSection: string;
  onSectionSelect: (id: string) => void;
  targetJournal: string;
  onJournalChange: (journal: string) => void;
  onSave: () => void;
  onExport: () => void;
  isSaving: boolean;
}) {
  const totalWords = sections.reduce((sum, s) => sum + s.wordCount, 0);
  const selectedJournal = JOURNAL_OPTIONS.find((j) => j.value === targetJournal);
  const journalWordLimit = selectedJournal?.wordLimit || 4000;
  const isOverLimit = totalWords > journalWordLimit;

  return (
    <div className="w-64 border-r bg-muted/20 p-4 space-y-6">
      <div>
        <h4 className="text-sm font-medium mb-3">Sections</h4>
        <nav className="space-y-1">
          {sections.map((section) => {
            const Icon = section.icon;
            const wordStatus = getWordCountStatus(section.wordCount, section.minWords, section.maxWords);
            return (
              <button
                key={section.id}
                onClick={() => onSectionSelect(section.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  activeSection === section.id
                    ? "bg-ros-primary/10 text-ros-primary"
                    : "hover:bg-muted"
                }`}
                data-testid={`nav-section-${section.id}`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span>{section.label}</span>
                </div>
                {wordStatus === "valid" ? (
                  <CheckCircle className="h-3 w-3 text-ros-success" />
                ) : wordStatus === "over" ? (
                  <AlertTriangle className="h-3 w-3 text-ros-alert" />
                ) : (
                  <span className="text-xs text-muted-foreground">{section.wordCount}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <Separator />

      <div>
        <Label className="text-sm">Target Journal</Label>
        <Select value={targetJournal} onValueChange={onJournalChange}>
          <SelectTrigger className="mt-2" data-testid="select-journal">
            <SelectValue placeholder="Select journal" />
          </SelectTrigger>
          <SelectContent>
            {JOURNAL_OPTIONS.map((journal) => (
              <SelectItem key={journal.value} value={journal.value}>
                {journal.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="p-3 rounded-lg bg-muted/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium">Total Word Count</span>
          <Badge
            variant="outline"
            className={
              isOverLimit
                ? "bg-ros-alert/10 text-ros-alert border-ros-alert/30"
                : "bg-ros-success/10 text-ros-success border-ros-success/30"
            }
          >
            {totalWords.toLocaleString()} / {journalWordLimit.toLocaleString()}
          </Badge>
        </div>
        <Progress
          value={Math.min((totalWords / journalWordLimit) * 100, 100)}
          className={`h-2 ${isOverLimit ? "[&>div]:bg-ros-alert" : ""}`}
        />
        {isOverLimit && (
          <p className="text-xs text-ros-alert mt-2">
            {totalWords - journalWordLimit} words over limit
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Button className="w-full" onClick={onSave} disabled={isSaving} data-testid="button-save">
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </>
          )}
        </Button>
        <Button variant="outline" className="w-full" onClick={onExport} data-testid="button-export">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ManuscriptEditorPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { requestApproval } = useAIApprovalGate();

  const manuscriptId = params.id || "new";

  // Initialize sections with empty content
  const [sections, setSections] = useState<ManuscriptSection[]>(
    SECTION_TEMPLATES.map((template) => ({
      ...template,
      content: "",
      wordCount: 0,
      isValid: false,
    }))
  );
  const [activeSection, setActiveSection] = useState("introduction");
  const [targetJournal, setTargetJournal] = useState("thyroid");
  const [title, setTitle] = useState("Untitled Manuscript");
  const [generatingSection, setGeneratingSection] = useState<string | null>(null);

  // Fetch manuscript data if editing existing
  const { data: manuscript, isLoading } = useQuery({
    queryKey: ["manuscript", manuscriptId],
    queryFn: async () => {
      if (manuscriptId === "new") return null;
      const res = await apiRequest("GET", `/api/ros/manuscripts/${manuscriptId}`);
      return res.json();
    },
    enabled: manuscriptId !== "new",
  });

  // Load manuscript data into state
  useEffect(() => {
    if (manuscript) {
      setTitle(manuscript.title || "Untitled Manuscript");
      setTargetJournal(manuscript.targetJournal || "thyroid");
      if (manuscript.sections) {
        setSections(
          SECTION_TEMPLATES.map((template) => {
            const saved = manuscript.sections.find((s: any) => s.id === template.id);
            const content = saved?.content || "";
            const wordCount = countWords(content);
            return {
              ...template,
              content,
              wordCount,
              isValid: wordCount >= template.minWords && wordCount <= template.maxWords,
              lastGenerated: saved?.lastGenerated,
            };
          })
        );
      }
    }
  }, [manuscript]);

  // Update section content
  const handleContentChange = useCallback((sectionId: string, content: string) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id === sectionId) {
          const wordCount = countWords(content);
          return {
            ...s,
            content,
            wordCount,
            isValid: wordCount >= s.minWords && wordCount <= s.maxWords,
          };
        }
        return s;
      })
    );
  }, []);

  // Generate section with AI
  const generateSection = useMutation({
    mutationFn: async (sectionId: string) => {
      const section = sections.find((s) => s.id === sectionId);
      if (!section) throw new Error("Section not found");

      // Get results section content for discussion generation
      const resultsSection = sections.find((s) => s.id === "results");

      let endpoint = "";
      let payload: any = { manuscriptId };

      switch (sectionId) {
        case "results":
          endpoint = "/api/manuscript/generate/results";
          payload = {
            ...payload,
            datasetId: "current",
            analysisResults: { summary: "Analysis results from pipeline" },
          };
          break;
        case "discussion":
          endpoint = "/api/manuscript/generate/discussion";
          payload = {
            ...payload,
            resultsSection: resultsSection?.content || "",
            literatureContext: [],
          };
          break;
        default:
          // For intro, methods, conclusion - use a general text endpoint
          endpoint = "/api/ai/streaming/generate";
          payload = {
            prompt: `Generate a ${section.label} section for a research manuscript about ${title}.
                     Target length: ${section.minWords}-${section.maxWords} words.`,
            maxTokens: section.maxWords * 2,
          };
      }

      const res = await apiRequest("POST", endpoint, payload);
      return res.json();
    },
    onSuccess: (data, sectionId) => {
      const content = data.content || data.section?.content || "";
      handleContentChange(sectionId, content);
      setSections((prev) =>
        prev.map((s) =>
          s.id === sectionId ? { ...s, lastGenerated: new Date().toISOString() } : s
        )
      );
      toast({
        title: "Section Generated",
        description: `The ${sectionId} section has been generated successfully.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate section",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = async (sectionId: string) => {
    // Request AI approval
    const approved = await requestApproval({
      toolName: "Manuscript Section Generator",
      toolDescription: `Generate ${sectionId} section using AI`,
    });

    if (!approved) {
      toast({
        title: "Generation Cancelled",
        description: "AI generation was not approved.",
      });
      return;
    }

    setGeneratingSection(sectionId);
    try {
      await generateSection.mutateAsync(sectionId);
    } finally {
      setGeneratingSection(null);
    }
  };

  // Save manuscript
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        targetJournal,
        sections: sections.map((s) => ({
          id: s.id,
          name: s.name,
          content: s.content,
          wordCount: s.wordCount,
          lastGenerated: s.lastGenerated,
        })),
      };

      if (manuscriptId === "new") {
        const res = await apiRequest("POST", "/api/ros/manuscripts", payload);
        return res.json();
      } else {
        const res = await apiRequest("PATCH", `/api/ros/manuscripts/${manuscriptId}`, payload);
        return res.json();
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Manuscript Saved",
        description: "Your changes have been saved.",
      });
      if (manuscriptId === "new" && data.id) {
        setLocation(`/manuscripts/${data.id}`);
      }
      queryClient.invalidateQueries({ queryKey: ["manuscript", manuscriptId] });
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save manuscript",
        variant: "destructive",
      });
    },
  });

  // Export manuscript
  const handleExport = () => {
    const content = sections
      .map((s) => `## ${s.label}\n\n${s.content}`)
      .join("\n\n---\n\n");

    const blob = new Blob([`# ${title}\n\n${content}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Manuscript Exported",
      description: "Your manuscript has been downloaded as Markdown.",
    });
  };

  const activeContent = sections.find((s) => s.id === activeSection);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]" data-testid="page-manuscript-editor">
      <ManuscriptSidebar
        sections={sections}
        activeSection={activeSection}
        onSectionSelect={setActiveSection}
        targetJournal={targetJournal}
        onJournalChange={setTargetJournal}
        onSave={() => saveMutation.mutate()}
        onExport={handleExport}
        isSaving={saveMutation.isPending}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b p-4 bg-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/workflows")}
                data-testid="button-back"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-ros-primary" />
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-lg font-semibold border-none bg-transparent focus-visible:ring-0 p-0 h-auto"
                  placeholder="Manuscript Title"
                  data-testid="input-title"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                main
              </Badge>
              <Badge
                variant="secondary"
                className="bg-ros-workflow/10 text-ros-workflow border-ros-workflow/20"
              >
                Draft
              </Badge>
            </div>
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeContent && (
            <SectionEditor
              section={activeContent}
              onContentChange={(content) => handleContentChange(activeSection, content)}
              onGenerate={() => handleGenerate(activeSection)}
              isGenerating={generatingSection === activeSection}
            />
          )}
        </div>
      </div>
    </div>
  );
}
