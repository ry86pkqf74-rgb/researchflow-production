import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyArtifactsProps {
  onCreateClick?: () => void;
}

export function EmptyArtifacts({ onCreateClick }: EmptyArtifactsProps) {
  return (
    <Card data-testid="empty-artifacts">
      <CardContent className="flex items-center justify-center py-16">
        <div className="text-center max-w-sm">
          <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />

          <h3 className="text-lg font-semibold mb-2">No artifacts yet</h3>

          <p className="text-muted-foreground mb-6">
            Artifacts are generated outputs from your research runs, including papers,
            analysis reports, charts, and other deliverables. They'll appear here as
            you run analyses.
          </p>

          <div className="space-y-3">
            {onCreateClick && (
              <Button
                onClick={onCreateClick}
                className="w-full"
                data-testid="button-create-artifact"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Artifact
              </Button>
            )}

            <p className="text-xs text-muted-foreground">
              Learn more about{" "}
              <a href="/docs/artifacts" className="underline hover:text-foreground">
                managing artifacts
              </a>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
