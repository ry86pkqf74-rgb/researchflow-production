import { FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyProjectsProps {
  onCreateClick?: () => void;
}

export function EmptyProjects({ onCreateClick }: EmptyProjectsProps) {
  return (
    <Card data-testid="empty-projects">
      <CardContent className="flex items-center justify-center py-16">
        <div className="text-center max-w-sm">
          <FolderOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />

          <h3 className="text-lg font-semibold mb-2">No projects yet</h3>

          <p className="text-muted-foreground mb-6">
            Get started by creating your first research project. Projects help you organize
            your research, manage runs, and collaborate with your team.
          </p>

          <div className="space-y-3">
            <Button
              onClick={onCreateClick}
              className="w-full"
              data-testid="button-create-project"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Project
            </Button>

            <p className="text-xs text-muted-foreground">
              Not sure where to start? Check out our{" "}
              <a href="/docs/projects" className="underline hover:text-foreground">
                project guide
              </a>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
