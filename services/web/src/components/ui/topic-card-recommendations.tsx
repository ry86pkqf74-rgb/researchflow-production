/**
 * Topic Card Recommendations Component
 *
 * Displays AI-generated recommendations for PICO fields with overall assessment.
 * Shows strength analysis and improvement summary.
 */

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Target,
  ArrowRight
} from "lucide-react";

export interface TopicRecommendation {
  type: 'refine' | 'narrow' | 'expand';
  suggestion: string;
  reasoning: string;
  priority: 'high' | 'medium' | 'low';
}

export interface OverallAssessment {
  strength: 'weak' | 'moderate' | 'strong';
  summary: string;
  improvementPotential: string;
}

export interface TopicRecommendationsData {
  overallAssessment: OverallAssessment;
  recommendations: {
    population: TopicRecommendation[];
    intervention: TopicRecommendation[];
    comparator: TopicRecommendation[];
    outcomes: TopicRecommendation[];
    timeframe: TopicRecommendation[];
  };
  authorizedBy: string;
  generatedAt: string;
}

interface TopicCardRecommendationsProps {
  data: TopicRecommendationsData;
  onApplyRecommendation: (field: string, suggestion: string) => void;
  onDismiss: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  population: "Target Population",
  intervention: "Intervention/Exposure",
  comparator: "Comparator Group",
  outcomes: "Primary Outcomes",
  timeframe: "Study Timeframe"
};

const TYPE_COLORS: Record<string, string> = {
  refine: "bg-blue-500/10 text-blue-700 border-blue-200",
  narrow: "bg-amber-500/10 text-amber-700 border-amber-200",
  expand: "bg-purple-500/10 text-purple-700 border-purple-200"
};

const PRIORITY_ICONS: Record<string, React.ReactNode> = {
  high: <AlertCircle className="h-3 w-3 text-red-600" />,
  medium: <Target className="h-3 w-3 text-amber-600" />,
  low: <CheckCircle2 className="h-3 w-3 text-green-600" />
};

const STRENGTH_COLORS: Record<string, string> = {
  weak: "text-red-600 bg-red-50 border-red-200",
  moderate: "text-amber-600 bg-amber-50 border-amber-200",
  strong: "text-green-600 bg-green-50 border-green-200"
};

export function TopicCardRecommendations({
  data,
  onApplyRecommendation,
  onDismiss
}: TopicCardRecommendationsProps) {
  const [expandedFields, setExpandedFields] = useState<Record<string, boolean>>({
    population: true,
    intervention: true,
    comparator: true,
    outcomes: true,
    timeframe: true
  });
  const [appliedRecommendations, setAppliedRecommendations] = useState<Set<string>>(new Set());

  const toggleField = (field: string) => {
    setExpandedFields(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleApply = (field: string, suggestion: string, index: number) => {
    const key = `${field}-${index}`;
    setAppliedRecommendations(prev => new Set([...prev, key]));
    onApplyRecommendation(field, suggestion);
  };

  const isApplied = (field: string, index: number) => {
    return appliedRecommendations.has(`${field}-${index}`);
  };

  return (
    <div className="space-y-4" data-testid="topic-recommendations">
      {/* Overall Assessment Card */}
      <Card className="p-6 border-2 border-ros-workflow/30 bg-gradient-to-br from-ros-workflow/5 to-transparent">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-ros-workflow/10">
                <Sparkles className="h-6 w-6 text-ros-workflow" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">AI Analysis Complete</h3>
                <p className="text-sm text-muted-foreground">
                  Generated {new Date(data.generatedAt).toLocaleString()} • Authorized by {data.authorizedBy}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Strength Assessment */}
          <Alert className={`${STRENGTH_COLORS[data.overallAssessment.strength]} border`}>
            <TrendingUp className="h-4 w-4" />
            <AlertTitle className="font-semibold">
              Current Topic Strength: {data.overallAssessment.strength.charAt(0).toUpperCase() + data.overallAssessment.strength.slice(1)}
            </AlertTitle>
            <AlertDescription className="mt-2">
              {data.overallAssessment.summary}
            </AlertDescription>
          </Alert>

          {/* Improvement Potential */}
          <Alert className="bg-blue-50 border-blue-200">
            <ArrowRight className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-900 font-semibold">What These Recommendations Will Do</AlertTitle>
            <AlertDescription className="mt-2 text-blue-800">
              {data.overallAssessment.improvementPotential}
            </AlertDescription>
          </Alert>
        </div>
      </Card>

      {/* Recommendations by Field */}
      <div className="space-y-3">
        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Recommendations by Field
        </h4>
        
        {Object.entries(data.recommendations).map(([field, recommendations]) => (
          <Card key={field} className="overflow-hidden">
            <Collapsible
              open={expandedFields[field]}
              onOpenChange={() => toggleField(field)}
            >
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-normal">
                      {FIELD_LABELS[field]}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {recommendations.length} recommendations
                    </span>
                  </div>
                  {expandedFields[field] ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-3">
                  {recommendations.map((rec, index) => (
                    <Card
                      key={index}
                      className="p-4 border bg-muted/30"
                      data-testid={`recommendation-${field}-${index}`}
                    >
                      <div className="space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={`${TYPE_COLORS[rec.type]} border text-xs`}>
                              {rec.type}
                            </Badge>
                            <div className="flex items-center gap-1">
                              {PRIORITY_ICONS[rec.priority]}
                              <span className="text-xs text-muted-foreground">
                                {rec.priority} priority
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Suggestion */}
                        <div>
                          <p className="text-sm font-medium leading-relaxed">
                            {rec.suggestion}
                          </p>
                        </div>

                        {/* Reasoning */}
                        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-background/50 p-2 rounded">
                          <CheckCircle2 className="h-3 w-3 mt-0.5 flex-shrink-0 text-green-600" />
                          <span>{rec.reasoning}</span>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          {isApplied(field, index) ? (
                            <Badge variant="secondary" className="bg-green-500/10 text-green-700 border-green-200">
                              <Check className="h-3 w-3 mr-1" />
                              Applied
                            </Badge>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleApply(field, rec.suggestion, index)}
                                className="text-xs"
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Apply to Field
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs text-muted-foreground"
                              >
                                Dismiss
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>
    </div>
  );
}
