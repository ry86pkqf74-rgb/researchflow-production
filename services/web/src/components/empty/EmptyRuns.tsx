import { Activity, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyRunsProps {
  onCreateClick?: () => void;
  projectName?: string;
}

export function EmptyRuns({ onCreateClick, projectName = "this project" }: EmptyRunsProps) {
  return (
    <Card data-testid="empty-runs">
      <CardContent className="flex items-center justify-center py-16">
        <div className="text-center max-w-sm">
          <Activity className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />

          <h3 className="text-lg font-semibold mb-2">No runs yet</h3>

          <p className="text-muted-foreground mb-6">
            Start your first research run in {projectName}. Runs let you execute
            analyses, generate insights, and track progress through your research workflow.
          </p>

          <div className="space-y-3">
            <Button
              onClick={onCreateClick}
              className="w-full"
              data-testid="button-create-run"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Run
            </Button>

            <p className="text-xs text-muted-foreground">
              Learn more about{" "}
              <a href="/docs/runs" className="underline hover:text-foreground">
                creating and managing runs
              </a>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
