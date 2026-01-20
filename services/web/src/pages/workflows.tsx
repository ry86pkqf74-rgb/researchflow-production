/**
 * Workflows Page
 * 
 * Lists all workflows with filtering by status.
 * RBAC: VIEWER can view, RESEARCHER+ can create, STEWARD+ can edit, ADMIN can publish.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  MoreHorizontal,
  Workflow,
  Play,
  Pause,
  Archive,
  Copy,
  Pencil,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Loader2,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";

interface WorkflowSummary {
  id: string;
  name: string;
  description: string | null;
  status: string;
  current_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  run_count?: number;
  last_run_at?: string;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  definition: object;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-500",
  ACTIVE: "bg-green-500",
  PAUSED: "bg-amber-500",
  ARCHIVED: "bg-gray-400",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  DRAFT: <FileText className="h-4 w-4" />,
  ACTIVE: <CheckCircle2 className="h-4 w-4" />,
  PAUSED: <Pause className="h-4 w-4" />,
  ARCHIVED: <Archive className="h-4 w-4" />,
};

async function fetchWorkflows(status?: string): Promise<WorkflowSummary[]> {
  const params = new URLSearchParams();
  if (status && status !== "all") params.set("status", status);
  const response = await fetch(`/api/workflows?${params}`, { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch workflows");
  return response.json();
}

async function fetchTemplates(): Promise<WorkflowTemplate[]> {
  const response = await fetch("/api/workflows/templates", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch templates");
  return response.json();
}

async function createWorkflow(data: { name: string; description?: string; template_id?: string }) {
  const response = await fetch("/api/workflows", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create workflow");
  }
  return response.json();
}

export default function WorkflowsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [newWorkflowDesc, setNewWorkflowDesc] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  
  const { user } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const canCreate = user?.role && ["RESEARCHER", "STEWARD", "ADMIN"].includes(user.role);
  const canEdit = user?.role && ["STEWARD", "ADMIN"].includes(user.role);

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ["workflows", statusFilter],
    queryFn: () => fetchWorkflows(statusFilter),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["workflow-templates"],
    queryFn: fetchTemplates,
  });

  const createMutation = useMutation({
    mutationFn: createWorkflow,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      setCreateDialogOpen(false);
      setNewWorkflowName("");
      setNewWorkflowDesc("");
      setSelectedTemplate("");
      toast({
        title: "Workflow created",
        description: `"${data.name}" has been created successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create workflow",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredWorkflows = workflows.filter((w) =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateWorkflow = () => {
    if (!newWorkflowName.trim()) return;
    createMutation.mutate({
      name: newWorkflowName.trim(),
      description: newWorkflowDesc.trim() || undefined,
      template_id: selectedTemplate || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
            <p className="text-muted-foreground">
              Create and manage custom research workflows
            </p>
          </div>
          {canCreate && (
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Workflow
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Workflow</DialogTitle>
                  <DialogDescription>
                    Start from scratch or use a template to create your workflow.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="My Research Workflow"
                      value={newWorkflowName}
                      onChange={(e) => setNewWorkflowName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe your workflow..."
                      value={newWorkflowDesc}
                      onChange={(e) => setNewWorkflowDesc(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="template">Template (optional)</Label>
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                      <SelectTrigger>
                        <SelectValue placeholder="Start from scratch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Start from scratch</SelectItem>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateWorkflow}
                    disabled={!newWorkflowName.trim() || createMutation.isPending}
                  >
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Workflow
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search workflows..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="DRAFT">Draft</TabsTrigger>
              <TabsTrigger value="ACTIVE">Active</TabsTrigger>
              <TabsTrigger value="PAUSED">Paused</TabsTrigger>
              <TabsTrigger value="ARCHIVED">Archived</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredWorkflows.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Workflow className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No workflows found</h3>
              <p className="text-muted-foreground text-center mb-4">
                {searchQuery
                  ? "No workflows match your search criteria."
                  : "Get started by creating your first workflow."}
              </p>
              {canCreate && !searchQuery && (
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Workflow
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredWorkflows.map((workflow) => (
              <Card key={workflow.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">
                        <Link href={`/workflows/${workflow.id}`} className="hover:underline">
                          {workflow.name}
                        </Link>
                      </CardTitle>
                      <CardDescription className="line-clamp-2">
                        {workflow.description || "No description"}
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/workflows/${workflow.id}`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        {canEdit && (
                          <>
                            <DropdownMenuItem>
                              <Archive className="mr-2 h-4 w-4" />
                              Archive
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge className={`${STATUS_COLORS[workflow.status]} text-white`}>
                      {STATUS_ICONS[workflow.status]}
                      <span className="ml-1">{workflow.status}</span>
                    </Badge>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="mr-1 h-3 w-3" />
                      v{workflow.current_version}
                    </div>
                  </div>
                  {workflow.run_count !== undefined && (
                    <div className="mt-3 text-sm text-muted-foreground">
                      {workflow.run_count} runs
                      {workflow.last_run_at && (
                        <span> · Last run {new Date(workflow.last_run_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
