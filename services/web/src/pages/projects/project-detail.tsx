/**
 * Project Detail Page
 *
 * Shows a single project with its workflows, settings, and activity.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'wouter';
import { useProjectStore } from '@/stores/project-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft,
  Plus,
  MoreVertical,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  AlertCircle,
  Settings,
  Users,
  FileText,
  Workflow,
  Trash2,
  Edit,
} from 'lucide-react';
import type { Workflow as WorkflowType, CreateWorkflowInput } from '@/types/project';

// ============================================================================
// Create Workflow Dialog
// ============================================================================

function CreateWorkflowDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { createWorkflow, isCreating } = useProjectStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await createWorkflow(projectId, { name: name.trim(), description: description.trim() });
      setOpen(false);
      setName('');
      setDescription('');
    } catch (error) {
      console.error('Failed to create workflow:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Workflow
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Workflow</DialogTitle>
            <DialogDescription>
              Start a new research workflow within this project.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="wf-name">Workflow Name</Label>
              <Input
                id="wf-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Literature Search"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="wf-description">Description</Label>
              <Textarea
                id="wf-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this workflow..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isCreating}>
              {isCreating ? 'Creating...' : 'Create Workflow'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Workflow Card Component
// ============================================================================

function WorkflowCard({ workflow, projectId }: { workflow: WorkflowType; projectId: string }) {
  const { deleteWorkflow, updateWorkflow } = useProjectStore();

  const statusConfig = {
    draft: { label: 'Draft', variant: 'outline' as const, icon: FileText, color: 'text-muted-foreground' },
    in_progress: { label: 'In Progress', variant: 'default' as const, icon: Play, color: 'text-blue-500' },
    paused: { label: 'Paused', variant: 'secondary' as const, icon: Pause, color: 'text-yellow-500' },
    completed: { label: 'Completed', variant: 'secondary' as const, icon: CheckCircle2, color: 'text-green-500' },
    failed: { label: 'Failed', variant: 'destructive' as const, icon: AlertCircle, color: 'text-destructive' },
  };

  const status = statusConfig[workflow.status];
  const StatusIcon = status.icon;

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this workflow?')) {
      await deleteWorkflow(projectId, workflow.id);
    }
  };

  const handleStart = async () => {
    await updateWorkflow(projectId, workflow.id, { status: 'in_progress' });
  };

  const handlePause = async () => {
    await updateWorkflow(projectId, workflow.id, { status: 'paused' });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-base">{workflow.name}</CardTitle>
            <CardDescription className="line-clamp-1">
              {workflow.description || 'No description'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={status.variant}>
              <StatusIcon className={`mr-1 h-3 w-3 ${status.color}`} />
              {status.label}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {workflow.status === 'draft' && (
                  <DropdownMenuItem onClick={handleStart}>
                    <Play className="mr-2 h-4 w-4" />
                    Start Workflow
                  </DropdownMenuItem>
                )}
                {workflow.status === 'in_progress' && (
                  <DropdownMenuItem onClick={handlePause}>
                    <Pause className="mr-2 h-4 w-4" />
                    Pause Workflow
                  </DropdownMenuItem>
                )}
                {workflow.status === 'paused' && (
                  <DropdownMenuItem onClick={handleStart}>
                    <Play className="mr-2 h-4 w-4" />
                    Resume Workflow
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Workflow
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{workflow.progress}%</span>
            </div>
            <Progress value={workflow.progress} className="h-2" />
          </div>

          {/* Stage info */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Stage {workflow.currentStage} of {workflow.totalStages}
            </span>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Updated {new Date(workflow.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Action button */}
          <Button variant="outline" className="w-full" asChild>
            <Link href={`/workflow/${workflow.id}`}>
              Open Workflow
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const { currentProject, fetchProjectById, isLoading, error } = useProjectStore();

  useEffect(() => {
    if (projectId) {
      fetchProjectById(projectId);
    }
  }, [projectId, fetchProjectById]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !currentProject) {
    return (
      <div className="container mx-auto py-6">
        <Card className="border-destructive">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Project not found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {error || 'The project you are looking for does not exist.'}
            </p>
            <Button asChild>
              <Link href="/projects">Back to Projects</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const project = currentProject;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/projects">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            <Badge
              variant={
                project.status === 'active'
                  ? 'default'
                  : project.status === 'completed'
                  ? 'secondary'
                  : 'outline'
              }
            >
              {project.status}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            {project.description || 'No description'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon">
            <Users className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
          <CreateWorkflowDialog projectId={project.id} />
        </div>
      </div>

      {/* Project Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workflows</CardTitle>
            <Workflow className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{project.workflows.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Play className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {project.workflows.filter((w) => w.status === 'in_progress').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {project.workflows.filter((w) => w.status === 'completed').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collaborators</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{project.collaborators.length + 1}</div>
          </CardContent>
        </Card>
      </div>

      {/* Workflows Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Workflows</h2>
        </div>

        {project.workflows.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Workflow className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No workflows yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first workflow to start your research pipeline.
              </p>
              <CreateWorkflowDialog projectId={project.id} />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {project.workflows.map((workflow) => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                projectId={project.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Project Settings Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Project Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">AI Approval Mode</p>
              <p className="text-sm">{project.settings.aiMode.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">PHI Protection</p>
              <p className="text-sm capitalize">{project.settings.phiProtection}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Governance Level</p>
              <p className="text-sm capitalize">{project.settings.governanceLevel}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
