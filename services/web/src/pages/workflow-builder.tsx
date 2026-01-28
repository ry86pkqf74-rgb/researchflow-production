/**
 * Workflow Builder Page
 * 
 * Visual DAG editor using ReactFlow for building custom workflows.
 * RBAC: VIEWER can view, STEWARD+ can edit, ADMIN can publish.
 */
import { useState, useCallback, useEffect, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
  NodeTypes,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";

import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Save,
  Play,
  Pause,
  MoreHorizontal,
  Plus,
  Trash2,
  Settings,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  FileText,
  Database,
  Brain,
  Mail,
  Shield,
  GitBranch,
  History,
  Upload,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

// Stage types available for workflow nodes
const STAGE_TYPES = [
  { id: "data_ingestion", name: "Data Ingestion", icon: Database, color: "#3b82f6" },
  { id: "ai_analysis", name: "AI Analysis", icon: Brain, color: "#8b5cf6" },
  { id: "human_review", name: "Human Review", icon: Shield, color: "#f59e0b" },
  { id: "transformation", name: "Transformation", icon: Zap, color: "#10b981" },
  { id: "export", name: "Export", icon: Upload, color: "#ec4899" },
  { id: "notification", name: "Notification", icon: Mail, color: "#6366f1" },
  { id: "conditional", name: "Conditional", icon: GitBranch, color: "#64748b" },
];

interface WorkflowDefinition {
  nodes: Array<{
    id: string;
    type: string;
    label: string;
    config: Record<string, unknown>;
    position: { x: number; y: number };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    condition?: string;
  }>;
  settings: {
    timeout_minutes: number;
    retry_policy: string;
    checkpoint_enabled: boolean;
  };
}

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  current_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface WorkflowVersion {
  id: string;
  workflow_id: string;
  version: number;
  definition: WorkflowDefinition;
  change_summary: string | null;
  created_by: string;
  created_at: string;
}

// Custom node component for workflow stages
function StageNode({ data, selected }: { data: any; selected: boolean }) {
  const stageType = STAGE_TYPES.find((s) => s.id === data.stageType);
  const Icon = stageType?.icon || FileText;

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-white shadow-sm min-w-[180px] ${
        selected ? "border-primary ring-2 ring-primary/20" : "border-border"
      }`}
      style={{ borderLeftColor: stageType?.color, borderLeftWidth: 4 }}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color: stageType?.color }} />
        <span className="font-medium text-sm">{data.label}</span>
      </div>
      {data.description && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {data.description}
        </p>
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  stage: StageNode,
};

async function fetchWorkflow(id: string): Promise<Workflow> {
  const response = await fetch(`/api/workflows/${id}`, { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch workflow");
  return response.json();
}

async function fetchLatestVersion(workflowId: string): Promise<WorkflowVersion> {
  const response = await fetch(`/api/workflows/${workflowId}/versions/latest`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to fetch workflow version");
  return response.json();
}

async function saveVersion(
  workflowId: string,
  definition: WorkflowDefinition,
  changeSummary?: string
): Promise<WorkflowVersion> {
  const response = await fetch(`/api/workflows/${workflowId}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ definition, change_summary: changeSummary }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to save workflow");
  }
  return response.json();
}

async function updateWorkflowStatus(id: string, status: string): Promise<Workflow> {
  const response = await fetch(`/api/workflows/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update workflow status");
  }
  return response.json();
}

export default function WorkflowBuilderPage() {
  const [, params] = useRoute("/workflows/:id");
  const [, setLocation] = useLocation();
  const workflowId = params?.id || "";

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [nodeSheetOpen, setNodeSheetOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [changeSummary, setChangeSummary] = useState("");
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [executeDialogOpen, setExecuteDialogOpen] = useState(false);
  const [executionInputs, setExecutionInputs] = useState<Record<string, string>>({});

  const { user } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const canEdit = user?.role && ["STEWARD", "ADMIN"].includes(user.role);
  const canPublish = user?.role === "ADMIN";

  const { data: workflow, isLoading: workflowLoading } = useQuery({
    queryKey: ["workflow", workflowId],
    queryFn: () => fetchWorkflow(workflowId!),
    enabled: !!workflowId,
  });

  const { data: version, isLoading: versionLoading, error: versionError } = useQuery({
    queryKey: ["workflow-version", workflowId],
    queryFn: () => fetchLatestVersion(workflowId!),
    enabled: !!workflowId,
    retry: false, // Don't retry if no version exists
  });

  // Detect if this is a standard ROS pipeline workflow
  const isStandardROSWorkflow = useMemo(() => {
    if (!version?.definition) return false;
    const def = version.definition;
    
    // Check if the definition has stage nodes that match the standard ROS pipeline
    // The standard-research template has specific stage IDs (1-19)
    const hasStageNodes = (def.nodes || []).some((n: any) => 
      n.type === "stage" && n.stageId && typeof n.stageId === "number"
    );
    
    return hasStageNodes;
  }, [version]);

  // If this is a standard ROS workflow, redirect to the main workflow execution page
  useEffect(() => {
    if (isStandardROSWorkflow && !workflowLoading && !versionLoading) {
      // Redirect to the main workflow execution interface
      setLocation("/workflow");
    }
  }, [isStandardROSWorkflow, workflowLoading, versionLoading, setLocation]);

  // Initialize nodes and edges from version definition
  useEffect(() => {
    if (version?.definition && !isStandardROSWorkflow) {
      const def = version.definition;
      const initialNodes: Node[] = (def.nodes || []).map((n) => ({
        id: n.id,
        type: "stage",
        position: n.position || { x: 0, y: 0 },
        data: {
          label: n.label,
          stageType: n.type,
          config: n.config || {},
          description: n.config?.description || "",
        },
      }));
      const initialEdges: Edge[] = (def.edges || []).map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.condition,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 2 },
      }));
      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [version, isStandardROSWorkflow, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { strokeWidth: 2 },
          },
          eds
        )
      );
      setHasUnsavedChanges(true);
    },
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setNodeSheetOpen(true);
  }, []);

  const addNode = useCallback(
    (stageType: string) => {
      const stage = STAGE_TYPES.find((s) => s.id === stageType);
      if (!stage) return;

      const newNode: Node = {
        id: `node_${Date.now()}`,
        type: "stage",
        position: { x: 250, y: nodes.length * 100 + 50 },
        data: {
          label: stage.name,
          stageType: stageType,
          config: {},
          description: "",
        },
      };
      setNodes((nds) => [...nds, newNode]);
      setHasUnsavedChanges(true);
    },
    [nodes, setNodes]
  );

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id)
    );
    setSelectedNode(null);
    setNodeSheetOpen(false);
    setHasUnsavedChanges(true);
  }, [selectedNode, setNodes, setEdges]);

  const updateSelectedNode = useCallback(
    (updates: Partial<Node["data"]>) => {
      if (!selectedNode) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNode.id ? { ...n, data: { ...n.data, ...updates } } : n
        )
      );
      setHasUnsavedChanges(true);
    },
    [selectedNode, setNodes]
  );

  const saveMutation = useMutation({
    mutationFn: (summary: string) => {
      const definition: WorkflowDefinition = {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.data.stageType,
          label: n.data.label,
          config: { ...n.data.config, description: n.data.description },
          position: n.position,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          condition: e.label as string | undefined,
        })),
        settings: {
          timeout_minutes: 60,
          retry_policy: "exponential",
          checkpoint_enabled: true,
        },
      };
      return saveVersion(workflowId!, definition, summary);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-version", workflowId] });
      queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
      setHasUnsavedChanges(false);
      setSaveDialogOpen(false);
      setChangeSummary("");
      toast({ title: "Workflow saved", description: "New version created successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => updateWorkflowStatus(workflowId!, "ACTIVE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
      setPublishDialogOpen(false);
      toast({ title: "Workflow published", description: "Workflow is now active." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to publish", description: error.message, variant: "destructive" });
    },
  });

  const executeMutation = useMutation({
    mutationFn: async (inputs: Record<string, string>) => {
      const response = await fetch(`/api/workflows/${workflowId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ inputs }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to execute workflow");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setExecuteDialogOpen(false);
      setExecutionInputs({});
      toast({ 
        title: "Workflow execution started", 
        description: `Execution ID: ${data.executionId}` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to execute", description: error.message, variant: "destructive" });
    },
  });

  const isLoading = workflowLoading || versionLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Workflow not found</h1>
          <Button asChild>
            <Link href="/workflows">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Workflows
            </Link>
          </Button>
        </main>
      </div>
    );
  }

  // If workflow has no version (empty workflow), show a message
  if (!isLoading && !version && versionError) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">No workflow definition</h1>
          <p className="text-muted-foreground mb-6">
            This workflow was created without a template and has no definition yet.
          </p>
          <div className="flex gap-4 justify-center">
            <Button asChild variant="outline">
              <Link href="/workflows">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Workflows
              </Link>
            </Button>
            {canEdit && (
              <Button onClick={() => {
                // Create an empty initial version
                const emptyDefinition: WorkflowDefinition = {
                  nodes: [],
                  edges: [],
                  settings: {
                    timeout_minutes: 60,
                    retry_policy: "exponential",
                    checkpoint_enabled: true,
                  },
                };
                saveMutation.mutate("Initial empty version");
              }}>
                Create Empty Workflow
              </Button>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top toolbar */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/workflows">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="font-semibold">{workflow.name}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{workflow.status}</Badge>
                <span>v{workflow.current_version}</span>
                {hasUnsavedChanges && (
                  <Badge variant="secondary" className="text-amber-600">
                    Unsaved changes
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSaveDialogOpen(true)}
                  disabled={!hasUnsavedChanges || saveMutation.isPending}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save
                </Button>
                {canPublish && workflow.status === "DRAFT" && (
                  <Button
                    size="sm"
                    onClick={() => setPublishDialogOpen(true)}
                    disabled={hasUnsavedChanges}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Publish
                  </Button>
                )}
                {workflow.status === "ACTIVE" && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => setExecuteDialogOpen(true)}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Execute
                  </Button>
                )}
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <History className="mr-2 h-4 w-4" />
                  Version History
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Workflow
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex">
        {/* Stage palette */}
        {canEdit && (
          <div className="w-64 border-r bg-muted/30 p-4">
            <h3 className="font-medium mb-3">Add Stage</h3>
            <div className="space-y-2">
              {STAGE_TYPES.map((stage) => {
                const Icon = stage.icon;
                return (
                  <Card
                    key={stage.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => addNode(stage.id)}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <div
                        className="p-2 rounded-md"
                        style={{ backgroundColor: `${stage.color}20` }}
                      >
                        <Icon className="h-4 w-4" style={{ color: stage.color }} />
                      </div>
                      <span className="text-sm font-medium">{stage.name}</span>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* ReactFlow canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Controls />
            <MiniMap />
            <Background gap={16} size={1} />
            <Panel position="bottom-center" className="bg-background/80 rounded-lg p-2 text-sm text-muted-foreground">
              Drag to connect stages • Click stage to edit • Scroll to zoom
            </Panel>
          </ReactFlow>
        </div>
      </div>

      {/* Node editor sheet */}
      <Sheet open={nodeSheetOpen} onOpenChange={setNodeSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit Stage</SheetTitle>
            <SheetDescription>Configure the selected workflow stage.</SheetDescription>
          </SheetHeader>
          {selectedNode && (
            <div className="mt-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="node-label">Label</Label>
                <Input
                  id="node-label"
                  value={selectedNode.data.label}
                  onChange={(e) => updateSelectedNode({ label: e.target.value })}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="node-type">Stage Type</Label>
                <Select
                  value={selectedNode.data.stageType}
                  onValueChange={(value) => updateSelectedNode({ stageType: value })}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGE_TYPES.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="node-description">Description</Label>
                <Textarea
                  id="node-description"
                  value={selectedNode.data.description || ""}
                  onChange={(e) => updateSelectedNode({ description: e.target.value })}
                  placeholder="Describe what this stage does..."
                  disabled={!canEdit}
                />
              </div>
              {canEdit && (
                <div className="pt-4">
                  <Button variant="destructive" onClick={deleteSelectedNode}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Stage
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Save dialog */}
      <AlertDialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new version of the workflow. Optionally describe your changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="change-summary">Change Summary (optional)</Label>
            <Textarea
              id="change-summary"
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder="What changed in this version?"
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => saveMutation.mutate(changeSummary)}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Version
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Publish dialog */}
      <AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              Publishing will make this workflow active and available for execution.
              Make sure all stages are properly configured.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
            >
              {publishMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Execute dialog */}
      <AlertDialog open={executeDialogOpen} onOpenChange={setExecuteDialogOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Execute Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              Provide input values for the workflow execution.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="input-param">Input Parameters (JSON format)</Label>
              <Textarea
                id="input-param"
                placeholder='{"key": "value", "param2": "value2"}'
                value={JSON.stringify(executionInputs, null, 2)}
                onChange={(e) => {
                  try {
                    setExecutionInputs(JSON.parse(e.target.value || '{}'));
                  } catch {
                    // Invalid JSON, ignore
                  }
                }}
                className="min-h-[200px] font-mono text-sm"
              />
              <p className="text-sm text-muted-foreground">
                Enter workflow inputs as JSON. These will be passed to the workflow stages.
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => executeMutation.mutate(executionInputs)}
              disabled={executeMutation.isPending}
            >
              {executeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Execute
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
