import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BookOpen,
  Star,
  Clock,
  Check,
  TrendingUp,
  Target,
  ExternalLink,
  Unlock,
  DollarSign,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { JournalRecommendation, SelectedJournal } from "@packages/core/types";

interface JournalSelectorProps {
  recommendations: JournalRecommendation[];
  selectedJournal?: SelectedJournal;
  onSelect?: (journal: JournalRecommendation) => void;
  isLoading?: boolean;
}

function FitScoreBadge({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 80) return "bg-ros-success/10 text-ros-success border-ros-success/30";
    if (score >= 60) return "bg-ros-workflow/10 text-ros-workflow border-ros-workflow/30";
    return "bg-muted text-muted-foreground";
  };

  return (
    <Badge variant="outline" className={`text-xs ${getColor()}`}>
      <Target className="h-3 w-3 mr-1" />
      {score}% fit
    </Badge>
  );
}

function JournalCard({
  journal,
  isSelected,
  onSelect,
}: {
  journal: JournalRecommendation;
  isSelected: boolean;
  onSelect?: () => void;
}) {
  return (
    <Card
      className={`p-4 transition-all ${
        isSelected
          ? "ring-2 ring-ros-primary bg-ros-primary/5"
          : "hover-elevate"
      }`}
      data-testid={`card-journal-${journal.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-4 w-4 text-ros-primary shrink-0" />
            <h4 className="font-medium text-sm truncate">{journal.name}</h4>
            {isSelected && (
              <Badge className="bg-ros-primary text-white text-[10px] shrink-0">
                <Check className="h-2.5 w-2.5 mr-1" />
                Selected
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  <span className="font-medium">{journal.impactFactor.toFixed(2)}</span>
                  <span>IF</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Impact Factor: {journal.impactFactor.toFixed(3)}</p>
              </TooltipContent>
            </Tooltip>

            <FitScoreBadge score={journal.fitScore} />

            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3 w-3" />
              <span>{journal.acceptanceRate}</span>
            </div>

            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{journal.reviewTime}</span>
            </div>

            {journal.openAccess && (
              <Badge variant="outline" className="text-[10px] bg-ros-success/10 text-ros-success border-ros-success/30">
                <Unlock className="h-2.5 w-2.5 mr-1" />
                Open Access
              </Badge>
            )}
          </div>

          <div className="space-y-2 mb-3">
            {journal.strengths.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {journal.strengths.slice(0, 3).map((strength, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">
                    {strength}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {journal.publicationFee && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              <span>APC: {journal.publicationFee}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button
            variant={isSelected ? "secondary" : "default"}
            size="sm"
            onClick={onSelect}
            disabled={isSelected}
            data-testid={`button-select-journal-${journal.id}`}
          >
            {isSelected ? (
              <>
                <Check className="h-3 w-3 mr-1" />
                Selected
              </>
            ) : (
              "Select"
            )}
          </Button>
          <Button variant="ghost" size="sm" className="text-xs">
            <ExternalLink className="h-3 w-3 mr-1" />
            Details
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function JournalSelector({
  recommendations,
  selectedJournal,
  onSelect,
  isLoading = false,
}: JournalSelectorProps) {
  const [showAll, setShowAll] = useState(false);

  const sortedRecommendations = [...recommendations].sort(
    (a, b) => b.fitScore - a.fitScore
  );

  const displayedJournals = showAll
    ? sortedRecommendations
    : sortedRecommendations.slice(0, 5);

  if (recommendations.length === 0 && !isLoading) {
    return (
      <Card className="p-6" data-testid="panel-journal-selector-empty">
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground" />
          <div>
            <h3 className="font-medium text-sm">No Journal Recommendations</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Complete the manuscript analysis to receive journal recommendations
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden" data-testid="panel-journal-selector">
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-ros-primary" />
            <span className="font-medium text-sm">Journal Recommendations</span>
            <Badge variant="secondary" className="text-xs">
              {recommendations.length} matches
            </Badge>
          </div>
          {selectedJournal && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Selected:</span>
              <Badge className="bg-ros-primary text-white">
                {selectedJournal.name}
              </Badge>
            </div>
          )}
        </div>
      </div>

      <ScrollArea className={recommendations.length > 3 ? "h-[400px]" : ""}>
        <div className="p-4 space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-4 animate-pulse">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-4 w-4 bg-muted rounded" />
                    <div className="h-4 w-40 bg-muted rounded" />
                  </div>
                  <div className="flex gap-2 mb-3">
                    <div className="h-5 w-16 bg-muted rounded" />
                    <div className="h-5 w-20 bg-muted rounded" />
                    <div className="h-5 w-24 bg-muted rounded" />
                  </div>
                  <div className="flex gap-1">
                    <div className="h-4 w-20 bg-muted rounded" />
                    <div className="h-4 w-24 bg-muted rounded" />
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <>
              {displayedJournals.map((journal) => (
                <JournalCard
                  key={journal.id}
                  journal={journal}
                  isSelected={selectedJournal?.journalId === journal.id}
                  onSelect={() => onSelect?.(journal)}
                />
              ))}

              {recommendations.length > 5 && (
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setShowAll(!showAll)}
                  data-testid="button-toggle-show-all-journals"
                >
                  {showAll
                    ? "Show Less"
                    : `Show ${recommendations.length - 5} More`}
                </Button>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {selectedJournal && (
        <div className="p-4 border-t border-border bg-muted/20">
          <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
            <span>
              Selected on{" "}
              {new Date(selectedJournal.selectedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <span className="flex items-center gap-1">
              <Target className="h-3 w-3" />
              Scope: {selectedJournal.scope}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
