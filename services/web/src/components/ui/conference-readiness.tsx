import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { usePhiGate, PhiStatusBadge } from "@/components/ui/phi-gate";
import {
  Image,
  Users,
  Monitor,
  CheckCircle,
  AlertTriangle,
  Download,
  FileText,
  Clock,
  Calendar,
  MapPin,
  Link2,
  QrCode,
  Mic,
  FileImage,
  MessageSquare,
  Target,
  Sparkles,
  X,
  Loader2,
  FileDown,
  Search,
  Globe,
  BookOpen,
  ArrowRight,
  RefreshCw,
  Star,
  Award
} from "lucide-react";

interface ConferenceDetails {
  name: string;
  date: string;
  location: string;
  abstractDeadline: string;
  submissionType: "poster" | "oral" | "symposium" | "workshop";
  timeAllotted: string;
  audienceSize: string;
}

interface ChecklistItem {
  id: string;
  label: string;
  category: "content" | "format" | "submission" | "logistics";
  required: boolean;
  completed: boolean;
  description?: string;
}

interface ConferenceReadinessState {
  conferenceDetails: ConferenceDetails;
  checklist: ChecklistItem[];
  posterDimensions: { width: number; height: number; unit: "inches" | "cm" };
  presentationSlides: number;
  speakingNotes: boolean;
  handoutsEnabled: boolean;
  qrCodeLinks: string[];
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: "abstract-approved", label: "Abstract approved/accepted", category: "submission", required: true, completed: false, description: "Confirmation of abstract acceptance from conference" },
  { id: "registration", label: "Conference registration complete", category: "submission", required: true, completed: false, description: "Paid registration and received confirmation" },
  { id: "author-disclosure", label: "Author disclosures submitted", category: "submission", required: true, completed: false, description: "COI and funding disclosures" },
  { id: "title-final", label: "Title finalized", category: "content", required: true, completed: true, description: "Final title matching abstract submission" },
  { id: "authors-confirmed", label: "Author list confirmed", category: "content", required: true, completed: true, description: "All authors and affiliations verified" },
  { id: "key-findings", label: "Key findings summarized", category: "content", required: true, completed: true, description: "3-5 main takeaway points identified" },
  { id: "figures-tables", label: "Figures and tables prepared", category: "content", required: true, completed: false, description: "High-resolution graphics ready" },
  { id: "references-formatted", label: "References formatted", category: "content", required: false, completed: false, description: "Citations in conference style" },
  { id: "poster-template", label: "Poster template applied", category: "format", required: true, completed: false, description: "Using conference-provided or approved template" },
  { id: "dimension-check", label: "Dimensions verified", category: "format", required: true, completed: false, description: "Poster/slides meet size requirements" },
  { id: "font-readability", label: "Font readability checked", category: "format", required: true, completed: false, description: "Text readable from expected viewing distance" },
  { id: "color-accessibility", label: "Color accessibility verified", category: "format", required: false, completed: false, description: "Color-blind friendly palette" },
  { id: "travel-booked", label: "Travel arrangements", category: "logistics", required: false, completed: false, description: "Flights/hotel booked" },
  { id: "printing-arranged", label: "Poster printing arranged", category: "logistics", required: false, completed: false, description: "Print vendor selected, timeline confirmed" },
  { id: "backup-files", label: "Backup files prepared", category: "logistics", required: true, completed: false, description: "USB drive, cloud backup, PDF versions" },
];

const POSTER_TEMPLATES = [
  { id: "landscape-48x36", label: "Landscape 48x36 in", width: 48, height: 36 },
  { id: "portrait-36x48", label: "Portrait 36x48 in", width: 36, height: 48 },
  { id: "a0-portrait", label: "A0 Portrait (84.1x118.9 cm)", width: 84, height: 119 },
  { id: "a1-portrait", label: "A1 Portrait (59.4x84.1 cm)", width: 59, height: 84 },
];

interface PredefinedConference {
  id: string;
  conferenceName: string;
  conferenceAcronym: string;
  abstractWordLimit: number;
  posterDimensions: { width: number; height: number; unit: string };
  slideCount: { min: number; max: number };
  presentationType: string;
  requiredSections: string[];
  speakingTimeMinutes: number;
}

interface ConferenceRequirementsResponse {
  conferences: PredefinedConference[];
  mode: string;
}

// Stage 20 Conference Prep interfaces
interface DiscoveredConference {
  id: string;
  name: string;
  acronym: string;
  location: string;
  dates: string;
  deadline: string;
  format: string[];
  relevanceScore: number;
  topics: string[];
  website?: string;
}

interface ConferenceDiscoverResponse {
  conferences: DiscoveredConference[];
  totalFound: number;
  searchCriteria: {
    keywords: string[];
    yearRange?: { start: number; end: number };
    locationPreference?: string;
  };
}

interface GuidelinesExtractResponse {
  conferenceId: string;
  conferenceName: string;
  guidelines: {
    abstractWordLimit?: number;
    posterDimensions?: { width: number; height: number; unit: string };
    slideLimits?: { min: number; max: number };
    speakingTime?: number;
    requiredSections: string[];
    fileFormats: string[];
    deadlines: { type: string; date: string }[];
    additionalRequirements: string[];
  };
  extractedAt: string;
  sourceUrl?: string;
}

interface MaterialsExportResponse {
  runId: string;
  status: string;
  files: { name: string; type: string; size: string; url: string }[];
  generatedAt: string;
}

interface ConferenceReadinessPanelProps {
  stageId: 17 | 18 | 19 | 20;
  onGenerateOutput?: (type: "poster" | "symposium" | "presentation" | "conference-prep") => void;
  /** Research session ID for Stage 20 exports */
  researchId?: string;
  /** Topic ID if available */
  topicId?: string | null;
}

export function ConferenceReadinessPanel({ stageId, onGenerateOutput, researchId, topicId }: ConferenceReadinessPanelProps) {
  const { phiStatus } = usePhiGate();
  const { toast } = useToast();
  
  const [selectedConferenceId, setSelectedConferenceId] = useState<string>("");
  const [state, setState] = useState<ConferenceReadinessState>({
    conferenceDetails: {
      name: "",
      date: "",
      location: "",
      abstractDeadline: "",
      submissionType: stageId === 17 ? "poster" : stageId === 18 ? "symposium" : "oral",
      timeAllotted: stageId === 17 ? "N/A" : stageId === 18 ? "20 minutes" : "12 minutes",
      audienceSize: stageId === 17 ? "Variable" : stageId === 18 ? "100-200" : "50-100",
    },
    checklist: DEFAULT_CHECKLIST,
    posterDimensions: { width: 48, height: 36, unit: "inches" },
    presentationSlides: 15,
    speakingNotes: true,
    handoutsEnabled: true,
    qrCodeLinks: [
      "https://doi.org/10.xxxx/manuscript",
      "https://github.com/research/supplementary",
    ],
  });

  const [showPreview, setShowPreview] = useState(false);
  const [newQrLink, setNewQrLink] = useState("");
  const [exportResult, setExportResult] = useState<any>(null);

  const { data: conferenceRequirements, isLoading: isLoadingConferences, error: conferenceError } = useQuery<ConferenceRequirementsResponse>({
    queryKey: ["/api/ros/conference/requirements"],
  });

  useEffect(() => {
    if (selectedConferenceId && conferenceRequirements?.conferences) {
      const selectedConference = conferenceRequirements.conferences.find(
        (conf) => conf.id === selectedConferenceId
      );
      if (selectedConference) {
        setState((prev) => ({
          ...prev,
          conferenceDetails: {
            ...prev.conferenceDetails,
            name: selectedConference.conferenceName,
            submissionType: selectedConference.presentationType as any,
            timeAllotted: `${selectedConference.speakingTimeMinutes} minutes`,
          },
          posterDimensions: {
            width: selectedConference.posterDimensions.width,
            height: selectedConference.posterDimensions.height,
            unit: selectedConference.posterDimensions.unit as "inches" | "cm",
          },
          presentationSlides: selectedConference.slideCount?.max || 15,
        }));
        toast({
          title: "Conference Selected",
          description: `Loaded requirements for ${selectedConference.conferenceAcronym}`,
        });
      }
    }
  }, [selectedConferenceId, conferenceRequirements, toast]);

  const exportMutation = useMutation({
    mutationFn: async (payload: any) => {
      // Stage 20 uses /materials/export endpoint, others use /export
      const endpoint = stageId === 20
        ? "/api/ros/conference/materials/export"
        : "/api/ros/conference/export";
      const response = await apiRequest("POST", endpoint, payload);
      return response.json();
    },
    onSuccess: (data) => {
      setExportResult(data);
      setShowPreview(true);
      toast({
        title: "Materials Generated",
        description: `Successfully generated ${data.files?.length || 0} conference materials`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to generate conference materials",
        variant: "destructive",
      });
    }
  });

  const toggleChecklistItem = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      checklist: prev.checklist.map(item =>
        item.id === id ? { ...item, completed: !item.completed } : item
      ),
    }));
  }, []);

  const addQrLink = useCallback(() => {
    if (!newQrLink.trim()) return;
    setState(prev => ({
      ...prev,
      qrCodeLinks: [...prev.qrCodeLinks, newQrLink.trim()],
    }));
    setNewQrLink("");
  }, [newQrLink]);

  const removeQrLink = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      qrCodeLinks: prev.qrCodeLinks.filter((_, i) => i !== index),
    }));
  }, []);

  const handleGenerate = useCallback(() => {
    const type = stageId === 17 ? "poster" : stageId === 18 ? "symposium" : stageId === 20 ? "conference-prep" : "presentation";
    onGenerateOutput?.(type);

    // Build payload based on stage
    if (stageId === 20) {
      // Stage 20: Conference Preparation - use materials/export endpoint format
      exportMutation.mutate({
        conference_id: selectedConferenceId || state.conferenceDetails.name,
        research_id: researchId || 'demo-research',
        material_types: ["poster_pdf", "slides_pptx"],
        title: state.conferenceDetails.name,
        blinded: false,
        custom_options: {
          poster_dimensions: state.posterDimensions,
          presentation_slides: state.presentationSlides,
          qr_links: state.qrCodeLinks,
          include_handouts: state.handoutsEnabled,
        }
      });
    } else {
      // Stages 17-19: Use legacy export endpoint format
      exportMutation.mutate({
        stage_id: stageId,
        title: state.conferenceDetails.name,
        presentation_duration: parseInt(state.conferenceDetails.timeAllotted) || 15,
        include_handouts: state.handoutsEnabled,
        qr_links: state.qrCodeLinks,
        poster_dimensions: stageId === 17 ? state.posterDimensions : undefined
      });
    }
  }, [stageId, onGenerateOutput, state, exportMutation, selectedConferenceId, researchId]);

  const handleDownloadFile = useCallback((file: any) => {
    // Check if we have a real URL from the server
    if (file.url && file.url.startsWith('/api/')) {
      // Real file URL - open in new tab or trigger download
      const link = document.createElement('a');
      link.href = file.url;
      link.download = file.name || file.filename;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (file.url) {
      // External URL - open in new tab
      window.open(file.url, '_blank', 'noopener,noreferrer');
    } else {
      // Fallback: Create a placeholder download for DEMO mode
      const content = `[Generated ${file.name || file.filename}]\n\nThis is a placeholder for the generated conference material.\nFile Type: ${file.type}\nSize: ${file.size || file.sizeBytes}\n\nIn a production environment, this would be the actual generated document.`;
      const blob = new Blob([content], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name || file.filename || "download.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }
  }, []);

  const completedItems = state.checklist.filter(i => i.completed).length;
  const totalItems = state.checklist.length;
  const requiredCompleted = state.checklist.filter(i => i.required && i.completed).length;
  const requiredTotal = state.checklist.filter(i => i.required).length;
  const readinessPercent = Math.round((completedItems / totalItems) * 100);
  const isReady = requiredCompleted === requiredTotal;

  const getStageInfo = () => {
    switch (stageId) {
      case 17:
        return {
          title: "Poster Preparation",
          icon: Image,
          description: "Generate research poster from manuscript",
          outputs: ["Research poster", "Visual abstracts", "QR code links"],
          borderClass: "border-ros-workflow/30",
          bgGradientClass: "bg-gradient-to-br from-ros-workflow/5 to-transparent",
          iconBgClass: "bg-ros-workflow/10",
          iconTextClass: "text-ros-workflow",
        };
      case 18:
        return {
          title: "Symposium Materials",
          icon: Users,
          description: "Create symposium presentation materials",
          outputs: ["Symposium slides", "Speaking notes", "Handouts"],
          borderClass: "border-ros-primary/30",
          bgGradientClass: "bg-gradient-to-br from-ros-primary/5 to-transparent",
          iconBgClass: "bg-ros-primary/10",
          iconTextClass: "text-ros-primary",
        };
      case 19:
        return {
          title: "Presentation Preparation",
          icon: Monitor,
          description: "Build conference presentation deck",
          outputs: ["Slide deck", "Speaker notes", "Q&A preparation"],
          borderClass: "border-ros-success/30",
          bgGradientClass: "bg-gradient-to-br from-ros-success/5 to-transparent",
          iconBgClass: "bg-ros-success/10",
          iconTextClass: "text-ros-success",
        };
      case 20:
      default:
        return {
          title: "Conference Preparation",
          icon: Award,
          description: "Full conference submission package with discovery and materials export",
          outputs: ["Conference poster (PDF)", "Presentation slides (PPTX)", "Submission bundle (ZIP)", "Manifest with hashes"],
          borderClass: "border-amber-500/30",
          bgGradientClass: "bg-gradient-to-br from-amber-500/5 to-transparent",
          iconBgClass: "bg-amber-500/10",
          iconTextClass: "text-amber-500",
        };
    }
  };

  const stageInfo = getStageInfo();
  const StageIcon = stageInfo.icon;

  const checklistByCategory = state.checklist.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  const categoryLabels: Record<string, { label: string; icon: typeof FileText }> = {
    content: { label: "Content", icon: FileText },
    format: { label: "Format & Design", icon: FileImage },
    submission: { label: "Submission", icon: Target },
    logistics: { label: "Logistics", icon: MapPin },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <Card className={`${stageInfo.borderClass} ${stageInfo.bgGradientClass}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-lg ${stageInfo.iconBgClass} flex items-center justify-center`}>
                <StageIcon className={`w-5 h-5 ${stageInfo.iconTextClass}`} />
              </div>
              <div>
                <CardTitle className="text-lg">{stageInfo.title}</CardTitle>
                <CardDescription>{stageInfo.description}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <PhiStatusBadge status={phiStatus} size="sm" showLabel={true} />
              <Badge 
                variant={isReady ? "default" : "outline"} 
                className={isReady ? "bg-ros-success/10 text-ros-success border-ros-success/30" : ""}
              >
                {isReady ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Ready
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {requiredTotal - requiredCompleted} required items pending
                  </>
                )}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="conference" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="conference" className="text-xs" data-testid="tab-conference">
                <Calendar className="w-3 h-3 mr-1" />
                Conference
              </TabsTrigger>
              <TabsTrigger value="checklist" className="text-xs" data-testid="tab-checklist">
                <CheckCircle className="w-3 h-3 mr-1" />
                Checklist
              </TabsTrigger>
              <TabsTrigger value="assets" className="text-xs" data-testid="tab-assets">
                <FileImage className="w-3 h-3 mr-1" />
                Assets
              </TabsTrigger>
              <TabsTrigger value="preview" className="text-xs" data-testid="tab-conf-preview">
                <Sparkles className="w-3 h-3 mr-1" />
                Generate
              </TabsTrigger>
            </TabsList>

            <TabsContent value="conference" className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Select Conference Template</Label>
                <Select
                  value={selectedConferenceId}
                  onValueChange={setSelectedConferenceId}
                  disabled={isLoadingConferences}
                >
                  <SelectTrigger data-testid="select-conference-template">
                    <SelectValue placeholder={isLoadingConferences ? "Loading conferences..." : "Select a conference..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {conferenceRequirements?.conferences?.map((conf) => (
                      <SelectItem key={conf.id} value={conf.id}>
                        {conf.conferenceAcronym} - {conf.conferenceName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {conferenceError && (
                  <p className="text-xs text-destructive">Failed to load conferences</p>
                )}
                {selectedConferenceId && conferenceRequirements?.conferences && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(() => {
                      const conf = conferenceRequirements.conferences.find(c => c.id === selectedConferenceId);
                      if (!conf) return null;
                      return (
                        <>
                          <Badge variant="outline" className="text-xs">
                            {conf.posterDimensions.width}x{conf.posterDimensions.height}" poster
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {conf.abstractWordLimit} word limit
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {conf.speakingTimeMinutes} min speaking
                          </Badge>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Conference Name</Label>
                  <Input 
                    value={state.conferenceDetails.name}
                    onChange={(e) => setState(prev => ({
                      ...prev,
                      conferenceDetails: { ...prev.conferenceDetails, name: e.target.value }
                    }))}
                    placeholder="Enter conference name"
                    data-testid="input-conference-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <Input 
                    value={state.conferenceDetails.date}
                    onChange={(e) => setState(prev => ({
                      ...prev,
                      conferenceDetails: { ...prev.conferenceDetails, date: e.target.value }
                    }))}
                    placeholder="e.g., October 15-19, 2025"
                    data-testid="input-conference-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Location</Label>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <Input 
                      value={state.conferenceDetails.location}
                      onChange={(e) => setState(prev => ({
                        ...prev,
                        conferenceDetails: { ...prev.conferenceDetails, location: e.target.value }
                      }))}
                      data-testid="input-conference-location"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Abstract Deadline</Label>
                  <Input 
                    value={state.conferenceDetails.abstractDeadline}
                    onChange={(e) => setState(prev => ({
                      ...prev,
                      conferenceDetails: { ...prev.conferenceDetails, abstractDeadline: e.target.value }
                    }))}
                    data-testid="input-abstract-deadline"
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Submission Type</Label>
                  <Select 
                    value={state.conferenceDetails.submissionType}
                    onValueChange={(v) => setState(prev => ({
                      ...prev,
                      conferenceDetails: { ...prev.conferenceDetails, submissionType: v as any }
                    }))}
                  >
                    <SelectTrigger data-testid="select-submission-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="poster">Poster</SelectItem>
                      <SelectItem value="oral">Oral Presentation</SelectItem>
                      <SelectItem value="symposium">Symposium</SelectItem>
                      <SelectItem value="workshop">Workshop</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Time Allotted</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Input 
                      value={state.conferenceDetails.timeAllotted}
                      onChange={(e) => setState(prev => ({
                        ...prev,
                        conferenceDetails: { ...prev.conferenceDetails, timeAllotted: e.target.value }
                      }))}
                      data-testid="input-time-allotted"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Est. Audience Size</Label>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <Input 
                      value={state.conferenceDetails.audienceSize}
                      onChange={(e) => setState(prev => ({
                        ...prev,
                        conferenceDetails: { ...prev.conferenceDetails, audienceSize: e.target.value }
                      }))}
                      data-testid="input-audience-size"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="checklist" className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Readiness Progress</span>
                  <Badge variant="outline">{completedItems}/{totalItems}</Badge>
                </div>
                <span className="text-sm text-muted-foreground">{readinessPercent}%</span>
              </div>
              <Progress value={readinessPercent} className="h-2" />

              <ScrollArea className="h-64">
                <div className="space-y-4 pr-4">
                  {Object.entries(checklistByCategory).map(([category, items]) => {
                    const catInfo = categoryLabels[category];
                    const CatIcon = catInfo.icon;
                    const catCompleted = items.filter(i => i.completed).length;
                    
                    return (
                      <div key={category} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <CatIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{catInfo.label}</span>
                          <Badge variant="outline" className="text-xs">
                            {catCompleted}/{items.length}
                          </Badge>
                        </div>
                        <div className="space-y-1 ml-6">
                          {items.map(item => (
                            <div
                              key={item.id}
                              className={`flex items-start gap-3 p-2 rounded-lg border transition-all cursor-pointer ${
                                item.completed
                                  ? "bg-ros-success/5 border-ros-success/20"
                                  : item.required
                                    ? "bg-ros-alert/5 border-ros-alert/20"
                                    : "border-muted hover:border-muted-foreground/30"
                              }`}
                              onClick={() => toggleChecklistItem(item.id)}
                              data-testid={`checklist-${item.id}`}
                            >
                              <Checkbox
                                checked={item.completed}
                                onCheckedChange={() => toggleChecklistItem(item.id)}
                                className="mt-0.5"
                                data-testid={`checkbox-checklist-${item.id}`}
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm ${item.completed ? "line-through text-muted-foreground" : ""}`}>
                                    {item.label}
                                  </span>
                                  {item.required && !item.completed && (
                                    <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                                      Required
                                    </Badge>
                                  )}
                                </div>
                                {item.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="assets" className="space-y-4">
              {stageId === 17 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Poster Dimensions</Label>
                  <Select 
                    value={`${state.posterDimensions.width}x${state.posterDimensions.height}`}
                    onValueChange={(v) => {
                      const template = POSTER_TEMPLATES.find(t => `${t.width}x${t.height}` === v);
                      if (template) {
                        setState(prev => ({
                          ...prev,
                          posterDimensions: { width: template.width, height: template.height, unit: "inches" }
                        }));
                      }
                    }}
                  >
                    <SelectTrigger data-testid="select-poster-dimensions">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POSTER_TEMPLATES.map(template => (
                        <SelectItem key={template.id} value={`${template.width}x${template.height}`}>
                          {template.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(stageId === 18 || stageId === 19) && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Number of Slides</Label>
                    <Input 
                      type="number"
                      value={state.presentationSlides}
                      onChange={(e) => setState(prev => ({
                        ...prev,
                        presentationSlides: parseInt(e.target.value) || 1
                      }))}
                      min={1}
                      max={100}
                      data-testid="input-slide-count"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Speaking Notes</Label>
                    <div className="flex items-center gap-2 h-9">
                      <Checkbox
                        checked={state.speakingNotes}
                        onCheckedChange={(checked) => setState(prev => ({
                          ...prev,
                          speakingNotes: !!checked
                        }))}
                        data-testid="checkbox-speaking-notes"
                      />
                      <span className="text-sm">Include speaker notes</span>
                    </div>
                  </div>
                </div>
              )}

              {stageId === 18 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Handouts</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={state.handoutsEnabled}
                      onCheckedChange={(checked) => setState(prev => ({
                        ...prev,
                        handoutsEnabled: !!checked
                      }))}
                      data-testid="checkbox-handouts"
                    />
                    <span className="text-sm">Generate printable handouts</span>
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <QrCode className="h-4 w-4" />
                    QR Code Links
                  </Label>
                  <Badge variant="outline">{state.qrCodeLinks.length}</Badge>
                </div>
                <div className="space-y-2">
                  {state.qrCodeLinks.map((link, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded bg-muted/50">
                      <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate flex-1">{link}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeQrLink(i)}
                        data-testid={`button-remove-qr-${i}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add link for QR code..."
                    value={newQrLink}
                    onChange={(e) => setNewQrLink(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addQrLink()}
                    data-testid="input-qr-link"
                  />
                  <Button onClick={addQrLink} data-testid="button-add-qr">
                    Add
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="space-y-4">
              <Card className="bg-muted/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-ros-workflow" />
                    Generation Preview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {stageInfo.outputs.map((output, i) => (
                      <div key={i} className="p-3 rounded-lg bg-background border">
                        <div className={`w-8 h-8 mx-auto rounded-full ${stageInfo.iconBgClass} flex items-center justify-center mb-2`}>
                          {i === 0 && <FileImage className={`h-4 w-4 ${stageInfo.iconTextClass}`} />}
                          {i === 1 && <Mic className={`h-4 w-4 ${stageInfo.iconTextClass}`} />}
                          {i === 2 && <MessageSquare className={`h-4 w-4 ${stageInfo.iconTextClass}`} />}
                        </div>
                        <p className="text-sm font-medium">{output}</p>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Readiness Status</p>
                    <div className="flex items-center gap-2">
                      {isReady ? (
                        <>
                          <CheckCircle className="h-5 w-5 text-ros-success" />
                          <span className="text-ros-success font-medium">All required items complete</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-5 w-5 text-ros-alert" />
                          <span className="text-ros-alert font-medium">
                            {requiredTotal - requiredCompleted} required items pending
                          </span>
                        </>
                      )}
                    </div>
                    <Progress value={readinessPercent} className="h-2 mt-2" />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button 
                      className="flex-1" 
                      variant={isReady ? "default" : "outline"}
                      onClick={handleGenerate}
                      disabled={!isReady || exportMutation.isPending}
                      data-testid="button-generate-conference"
                    >
                      {exportMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      {exportMutation.isPending ? "Generating..." : `Generate ${stageInfo.title}`}
                    </Button>
                    <Button variant="outline" data-testid="button-export-checklist">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="border-ros-success/30 bg-ros-success/5">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-ros-success" />
                    {stageInfo.title} Generated
                  </CardTitle>
                  {exportResult?.generated_at && (
                    <Badge variant="outline" className="font-mono text-xs">
                      {new Date(exportResult.generated_at).toLocaleTimeString()}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {exportResult?.files && exportResult.files.length > 0 ? (
                  <div className="space-y-2">
                    {exportResult.files.map((file: any, i: number) => (
                      <div 
                        key={i} 
                        className="flex items-center justify-between p-3 rounded-lg bg-background border"
                        data-testid={`export-file-${i}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-ros-success/10 flex items-center justify-center">
                            <FileDown className="h-4 w-4 text-ros-success" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{file.size}</p>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDownloadFile(file)}
                          data-testid={`button-download-file-${i}`}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    {stageInfo.outputs.map((output, i) => (
                      <div key={i} className="p-3 rounded-lg bg-background border text-center">
                        <CheckCircle className="h-5 w-5 text-ros-success mx-auto mb-2" />
                        <p className="text-sm font-medium">{output}</p>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="mt-2" 
                          onClick={() => handleDownloadFile({ name: output, type: "document", size: "~1 MB" })}
                          data-testid={`button-download-${i}`}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t">
                  <Badge className="bg-ros-success/10 text-ros-success border-ros-success/30">
                    {exportResult?.status || "completed"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {exportResult?.files?.length || stageInfo.outputs.length} files ready for download
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
