import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Presentation,
  FileText,
  AlertTriangle,
  Loader2,
  Download,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Save,
  Clock,
  CheckCircle,
  Sparkles,
} from "lucide-react";

export interface ConferenceRequirements {
  conferenceName: string;
  maxSlides: number;
  minSlides: number;
  speakingTimeMinutes: number;
  requiredSections?: string[];
}

export interface ManuscriptVersion {
  id: string;
  title: string;
  abstract: string;
  sections: {
    name: string;
    content: string;
  }[];
}

export interface Slide {
  id: string;
  slideNumber: number;
  title: string;
  content: string;
  speakerNotes: string;
  type: "title" | "content" | "conclusion" | "references";
}

export interface SlideDeckGeneratorProps {
  manuscript: ManuscriptVersion;
  conferenceRequirements: ConferenceRequirements;
  onExport?: (slides: Slide[], format: "pptx" | "pdf" | "html") => void;
}

interface GenerateSlidesResponse {
  slides: Slide[];
  estimatedDuration: number;
  warnings?: string[];
}

export function SlideDeckGenerator({
  manuscript,
  conferenceRequirements,
  onExport,
}: SlideDeckGeneratorProps) {
  const { toast } = useToast();
  const [slides, setSlides] = useState<Slide[]>([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [editingSlide, setEditingSlide] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ros/slides/generate", {
        manuscript: {
          id: manuscript.id,
          title: manuscript.title,
          abstract: manuscript.abstract,
          sections: manuscript.sections,
        },
        conferenceRequirements: {
          conferenceName: conferenceRequirements.conferenceName,
          maxSlides: conferenceRequirements.maxSlides,
          minSlides: conferenceRequirements.minSlides,
          speakingTimeMinutes: conferenceRequirements.speakingTimeMinutes,
          requiredSections: conferenceRequirements.requiredSections,
        },
      });
      return response.json() as Promise<GenerateSlidesResponse>;
    },
    onSuccess: (data) => {
      setSlides(data.slides);
      setHasGenerated(true);
      setActiveSlideIndex(0);
      
      const slideCount = data.slides.length;
      const { maxSlides, minSlides } = conferenceRequirements;
      
      if (slideCount > maxSlides) {
        toast({
          title: "Slide Limit Warning",
          description: `Generated ${slideCount} slides, which exceeds the conference limit of ${maxSlides}. Consider condensing content.`,
          variant: "destructive",
        });
      } else if (slideCount < minSlides) {
        toast({
          title: "Slide Count Notice",
          description: `Generated ${slideCount} slides, which is below the recommended minimum of ${minSlides}.`,
        });
      } else {
        toast({
          title: "Slides Generated",
          description: `Successfully generated ${slideCount} slides. Estimated duration: ${data.estimatedDuration} minutes.`,
        });
      }

      if (data.warnings && data.warnings.length > 0) {
        data.warnings.forEach((warning) => {
          toast({
            title: "Generation Warning",
            description: warning,
            variant: "destructive",
          });
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate slides. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSlideUpdate = useCallback((slideId: string, field: "title" | "content" | "speakerNotes", value: string) => {
    setSlides((prev) =>
      prev.map((slide) =>
        slide.id === slideId ? { ...slide, [field]: value } : slide
      )
    );
  }, []);

  const handleAddSlide = useCallback(() => {
    const newSlide: Slide = {
      id: `slide-${Date.now()}`,
      slideNumber: slides.length + 1,
      title: "New Slide",
      content: "",
      speakerNotes: "",
      type: "content",
    };
    setSlides((prev) => [...prev, newSlide]);
    setActiveSlideIndex(slides.length);
    toast({
      title: "Slide Added",
      description: "A new blank slide has been added to your deck.",
    });
  }, [slides.length, toast]);

  const handleDeleteSlide = useCallback((slideId: string) => {
    setSlides((prev) => {
      const filtered = prev.filter((s) => s.id !== slideId);
      return filtered.map((slide, idx) => ({
        ...slide,
        slideNumber: idx + 1,
      }));
    });
    if (activeSlideIndex >= slides.length - 1 && activeSlideIndex > 0) {
      setActiveSlideIndex(activeSlideIndex - 1);
    }
    toast({
      title: "Slide Deleted",
      description: "The slide has been removed from your deck.",
    });
  }, [activeSlideIndex, slides.length, toast]);

  const handleExport = useCallback((format: "pptx" | "pdf" | "html") => {
    onExport?.(slides, format);
    toast({
      title: "Export Started",
      description: `Exporting slides as ${format.toUpperCase()}...`,
    });
  }, [slides, onExport, toast]);

  const slideCountExceedsLimit = slides.length > conferenceRequirements.maxSlides;
  const slideCountBelowMinimum = slides.length < conferenceRequirements.minSlides;
  const estimatedMinutesPerSlide = conferenceRequirements.speakingTimeMinutes / (slides.length || 1);
  const activeSlide = slides[activeSlideIndex];

  const getSlideTypeColor = (type: Slide["type"]) => {
    switch (type) {
      case "title":
        return "bg-ros-primary/10 text-ros-primary border-ros-primary/30";
      case "conclusion":
        return "bg-ros-success/10 text-ros-success border-ros-success/30";
      case "references":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-ros-workflow/10 text-ros-workflow border-ros-workflow/30";
    }
  };

  return (
    <Card className="border-ros-workflow/30 bg-gradient-to-br from-ros-workflow/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-ros-workflow/10 flex items-center justify-center">
              <Presentation className="w-5 h-5 text-ros-workflow" />
            </div>
            <div>
              <CardTitle className="text-lg">Slide Deck Generator</CardTitle>
              <CardDescription>
                Generate presentation slides from {manuscript.title}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <Clock className="w-3 h-3 mr-1" />
              {conferenceRequirements.speakingTimeMinutes} min
            </Badge>
            <Badge 
              variant="outline" 
              className={slideCountExceedsLimit 
                ? "bg-destructive/10 text-destructive border-destructive/30" 
                : slideCountBelowMinimum 
                  ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                  : "bg-ros-success/10 text-ros-success border-ros-success/30"
              }
            >
              {slides.length}/{conferenceRequirements.maxSlides} slides
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!hasGenerated ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="w-16 h-16 rounded-full bg-ros-workflow/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-ros-workflow" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-semibold text-lg">Ready to Generate Slides</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Generate a presentation deck from your manuscript for {conferenceRequirements.conferenceName}.
                Target: {conferenceRequirements.minSlides}-{conferenceRequirements.maxSlides} slides for {conferenceRequirements.speakingTimeMinutes} minutes.
              </p>
            </div>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              data-testid="button-generate-slides"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Slides...
                </>
              ) : (
                <>
                  <Presentation className="w-4 h-4 mr-2" />
                  Generate Slides
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {slideCountExceedsLimit && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Slide Limit Exceeded</p>
                  <p className="text-xs text-destructive/80">
                    You have {slides.length} slides but the conference allows a maximum of {conferenceRequirements.maxSlides}. 
                    Consider condensing or removing {slides.length - conferenceRequirements.maxSlides} slide(s).
                  </p>
                </div>
              </div>
            )}

            {slideCountBelowMinimum && !slideCountExceedsLimit && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-600">Below Recommended Minimum</p>
                  <p className="text-xs text-amber-600/80">
                    You have {slides.length} slides but the recommended minimum is {conferenceRequirements.minSlides}. 
                    Consider expanding your content.
                  </p>
                </div>
              </div>
            )}

            <Tabs defaultValue="preview" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="preview" data-testid="tab-slide-preview">
                  <Presentation className="w-4 h-4 mr-1" />
                  Slide Preview
                </TabsTrigger>
                <TabsTrigger value="outline" data-testid="tab-slide-outline">
                  <FileText className="w-4 h-4 mr-1" />
                  Outline View
                </TabsTrigger>
              </TabsList>

              <TabsContent value="preview" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setActiveSlideIndex(Math.max(0, activeSlideIndex - 1))}
                      disabled={activeSlideIndex === 0}
                      data-testid="button-prev-slide"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground min-w-[80px] text-center">
                      Slide {activeSlideIndex + 1} of {slides.length}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setActiveSlideIndex(Math.min(slides.length - 1, activeSlideIndex + 1))}
                      disabled={activeSlideIndex === slides.length - 1}
                      data-testid="button-next-slide"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddSlide}
                      data-testid="button-add-slide"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Slide
                    </Button>
                    {activeSlide && slides.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteSlide(activeSlide.id)}
                        data-testid="button-delete-slide"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>

                {activeSlide && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 space-y-4">
                      <Card className="aspect-video relative bg-background">
                        <CardContent className="p-6 h-full flex flex-col">
                          <div className="flex items-center justify-between mb-4">
                            <Badge className={getSlideTypeColor(activeSlide.type)}>
                              {activeSlide.type}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingSlide(editingSlide === activeSlide.id ? null : activeSlide.id)}
                              data-testid="button-edit-slide"
                            >
                              {editingSlide === activeSlide.id ? (
                                <>
                                  <Save className="w-4 h-4 mr-1" />
                                  Done
                                </>
                              ) : (
                                <>
                                  <Edit3 className="w-4 h-4 mr-1" />
                                  Edit
                                </>
                              )}
                            </Button>
                          </div>

                          {editingSlide === activeSlide.id ? (
                            <div className="flex-1 space-y-3">
                              <div>
                                <Label className="text-xs text-muted-foreground">Slide Title</Label>
                                <Input
                                  value={activeSlide.title}
                                  onChange={(e) => handleSlideUpdate(activeSlide.id, "title", e.target.value)}
                                  className="mt-1"
                                  data-testid="input-slide-title"
                                />
                              </div>
                              <div className="flex-1">
                                <Label className="text-xs text-muted-foreground">Content</Label>
                                <Textarea
                                  value={activeSlide.content}
                                  onChange={(e) => handleSlideUpdate(activeSlide.id, "content", e.target.value)}
                                  className="mt-1 min-h-[120px]"
                                  data-testid="textarea-slide-content"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1">
                              <h2 className="text-xl font-semibold mb-4">{activeSlide.title}</h2>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {activeSlide.content || "No content yet..."}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <div className="text-xs text-muted-foreground flex items-center gap-4">
                        <span>
                          <Clock className="w-3 h-3 inline mr-1" />
                          ~{safeFixed(estimatedMinutesPerSlide, 1)} min per slide
                        </span>
                        {!slideCountExceedsLimit && !slideCountBelowMinimum && (
                          <span className="text-ros-success flex items-center">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Within conference limits
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Speaker Notes</Label>
                      <Textarea
                        value={activeSlide.speakerNotes}
                        onChange={(e) => handleSlideUpdate(activeSlide.id, "speakerNotes", e.target.value)}
                        placeholder="Add speaker notes for this slide..."
                        className="min-h-[200px] resize-none"
                        data-testid="textarea-speaker-notes"
                      />
                      <p className="text-xs text-muted-foreground">
                        Notes visible only to the presenter
                      </p>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="outline" className="mt-4">
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-2">
                    {slides.map((slide, index) => (
                      <div
                        key={slide.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          index === activeSlideIndex 
                            ? "border-ros-workflow bg-ros-workflow/5" 
                            : "border-border hover-elevate"
                        }`}
                        onClick={() => setActiveSlideIndex(index)}
                        data-testid={`outline-slide-${index}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-muted-foreground font-mono w-6">
                              {slide.slideNumber}
                            </span>
                            <Badge variant="outline" className={`text-xs ${getSlideTypeColor(slide.type)}`}>
                              {slide.type}
                            </Badge>
                            <span className="text-sm font-medium truncate">
                              {slide.title}
                            </span>
                          </div>
                          {slide.speakerNotes && (
                            <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </CardContent>

      {hasGenerated && slides.length > 0 && (
        <CardFooter className="flex items-center justify-between gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            data-testid="button-regenerate-slides"
          >
            {generateMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Regenerate
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleExport("pdf")}
              data-testid="button-export-pdf"
            >
              <Download className="w-4 h-4 mr-1" />
              PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport("html")}
              data-testid="button-export-html"
            >
              <Download className="w-4 h-4 mr-1" />
              HTML
            </Button>
            <Button
              onClick={() => handleExport("pptx")}
              data-testid="button-export-pptx"
            >
              <Download className="w-4 h-4 mr-1" />
              Export PPTX
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
