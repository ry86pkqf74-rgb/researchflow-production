import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  TopicVersionBadge,
  OutdatedWarning,
} from "@/components/ui/topic-version-badge";
import { usePhiGate, PhiStatusBadge } from "@/components/ui/phi-gate";
import {
  GitBranch,
  Plus,
  GitCompare,
  FileText,
  Clock,
  User,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ManuscriptBranch, ManuscriptVersion } from "@packages/core/types";

interface ManuscriptWorkspaceProps {
  branches: ManuscriptBranch[];
  activeBranchId: string;
  currentTopicVersion: string;
  compareMode?: boolean;
  onBranchSelect?: (branchId: string) => void;
  onCreateBranch?: (name: string, fromBranchId: string) => void;
  onToggleCompareMode?: (enabled: boolean) => void;
  onCompareBranches?: (branchId1: string, branchId2: string) => void;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusBadge(status: ManuscriptVersion["status"]) {
  const configs = {
    draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
    review: { label: "In Review", className: "bg-ros-workflow/10 text-ros-workflow border-ros-workflow/30" },
    approved: { label: "Approved", className: "bg-ros-success/10 text-ros-success border-ros-success/30" },
    archived: { label: "Archived", className: "bg-muted text-muted-foreground opacity-60" },
  };
  const config = configs[status];
  return (
    <Badge variant="outline" className={`text-xs ${config.className}`}>
      {config.label}
    </Badge>
  );
}

function DiffHighlight({ 
  content, 
  changedSections 
}: { 
  content: string; 
  changedSections?: string[];
}) {
  if (!changedSections || changedSections.length === 0) {
    return <div className="text-sm text-foreground whitespace-pre-wrap">{content}</div>;
  }

  const paragraphs = content.split("\n\n");
  
  return (
    <div className="space-y-2">
      {paragraphs.map((paragraph, index) => {
        const isChanged = changedSections.some(section => 
          paragraph.toLowerCase().includes(section.toLowerCase())
        );
        return (
          <div
            key={index}
            className={`text-sm p-2 rounded ${
              isChanged 
                ? "bg-ros-alert/10 border-l-2 border-ros-alert" 
                : "text-foreground"
            }`}
          >
            {isChanged && (
              <span className="text-xs text-ros-alert font-medium block mb-1">
                Changed
              </span>
            )}
            {paragraph}
          </div>
        );
      })}
    </div>
  );
}

function BranchTab({
  branch,
  currentTopicVersion,
}: {
  branch: ManuscriptBranch;
  currentTopicVersion: string;
}) {
  const currentVersion = branch.versions.find(v => v.id === branch.currentVersionId);
  const isOutdated = currentVersion && currentVersion.topicVersionHash !== currentTopicVersion;

  return (
    <div className="flex items-center gap-2">
      <GitBranch className="h-3 w-3" />
      <span>{branch.name}</span>
      {branch.isMain && (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          main
        </Badge>
      )}
      {isOutdated && (
        <AlertTriangle className="h-3 w-3 text-ros-alert" />
      )}
    </div>
  );
}

export function ManuscriptWorkspace({
  branches,
  activeBranchId,
  currentTopicVersion,
  compareMode = false,
  onBranchSelect,
  onCreateBranch,
  onToggleCompareMode,
  onCompareBranches,
}: ManuscriptWorkspaceProps) {
  const [newBranchName, setNewBranchName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  
  const { phiStatus } = usePhiGate();

  const activeBranch = branches.find(b => b.id === activeBranchId);

  const handleCreateBranch = () => {
    if (newBranchName.trim() && onCreateBranch) {
      onCreateBranch(newBranchName.trim(), activeBranchId);
      setNewBranchName("");
      setCreateDialogOpen(false);
    }
  };

  const handleCompareSelect = (branchId: string) => {
    setSelectedForCompare(prev => {
      if (prev.includes(branchId)) {
        return prev.filter(id => id !== branchId);
      }
      if (prev.length >= 2) {
        return [prev[1], branchId];
      }
      return [...prev, branchId];
    });
  };

  const handleStartCompare = () => {
    if (selectedForCompare.length === 2 && onCompareBranches) {
      onCompareBranches(selectedForCompare[0], selectedForCompare[1]);
    }
  };

  if (branches.length === 0) {
    return (
      <Card className="p-6" data-testid="panel-manuscript-workspace-empty">
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <FileText className="h-12 w-12 text-muted-foreground" />
          <div>
            <h3 className="font-medium">No Manuscript Branches</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first manuscript branch to start writing
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-first-branch">
                <Plus className="h-4 w-4 mr-2" />
                Create Branch
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Branch</DialogTitle>
                <DialogDescription>
                  Create a new manuscript branch to explore different versions
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="branch-name">Branch Name</Label>
                <Input
                  id="branch-name"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="e.g., methods-revision, reviewer-feedback"
                  className="mt-2"
                  data-testid="input-branch-name"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateBranch} data-testid="button-confirm-create-branch">
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden" data-testid="panel-manuscript-workspace">
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-ros-primary" />
            <span className="font-medium text-sm">Manuscript Workspace</span>
            <Badge variant="secondary" className="text-xs">
              {branches.length} branch{branches.length !== 1 ? "es" : ""}
            </Badge>
            <PhiStatusBadge status={phiStatus} size="sm" showLabel={true} />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="compare-mode"
                checked={compareMode}
                onCheckedChange={onToggleCompareMode}
                data-testid="switch-compare-mode"
              />
              <Label htmlFor="compare-mode" className="text-sm cursor-pointer">
                <GitCompare className="h-3 w-3 inline mr-1" />
                Compare
              </Label>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-create-branch">
                  <Plus className="h-3 w-3 mr-1" />
                  New Branch
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Branch</DialogTitle>
                  <DialogDescription>
                    Create a new manuscript branch from "{activeBranch?.name || 'current'}"
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="branch-name">Branch Name</Label>
                  <Input
                    id="branch-name"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    placeholder="e.g., methods-revision, reviewer-feedback"
                    className="mt-2"
                    data-testid="input-branch-name"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateBranch} data-testid="button-confirm-create-branch">
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {compareMode ? (
        <div className="p-4">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-3">
              Select two branches to compare:
            </p>
            <div className="flex flex-wrap gap-2">
              {branches.map((branch) => (
                <Button
                  key={branch.id}
                  variant={selectedForCompare.includes(branch.id) ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleCompareSelect(branch.id)}
                  data-testid={`button-compare-select-${branch.id}`}
                >
                  <GitBranch className="h-3 w-3 mr-1" />
                  {branch.name}
                  {selectedForCompare.includes(branch.id) && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      {selectedForCompare.indexOf(branch.id) + 1}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </div>
          {selectedForCompare.length === 2 && (
            <Button onClick={handleStartCompare} data-testid="button-start-compare">
              <GitCompare className="h-4 w-4 mr-2" />
              Compare Selected Branches
            </Button>
          )}
        </div>
      ) : (
        <Tabs value={activeBranchId} onValueChange={onBranchSelect}>
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-auto">
            {branches.map((branch) => (
              <TabsTrigger
                key={branch.id}
                value={branch.id}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-ros-primary data-[state=active]:bg-transparent px-4 py-3"
                data-testid={`tab-branch-${branch.id}`}
              >
                <BranchTab
                  branch={branch}
                  currentTopicVersion={currentTopicVersion}
                />
              </TabsTrigger>
            ))}
          </TabsList>

          {branches.map((branch) => {
            const version = branch.versions.find(v => v.id === branch.currentVersionId);
            if (!version) return null;

            return (
              <TabsContent key={branch.id} value={branch.id} className="p-4 mt-0">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <TopicVersionBadge
                        versionHash={version.topicVersionHash}
                        size="sm"
                      />
                      <OutdatedWarning
                        currentTopicVersion={currentTopicVersion}
                        stageTopicVersion={version.topicVersionHash}
                        stageName={branch.name}
                        size="sm"
                      />
                      {getStatusBadge(version.status)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(version.updatedAt)}
                      </span>
                      {version.createdBy && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {version.createdBy}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border rounded-lg p-4 bg-muted/20">
                    <DiffHighlight
                      content={version.content}
                      changedSections={version.changedSections}
                    />
                  </div>

                  {version.changedSections && version.changedSections.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <AlertTriangle className="h-3 w-3 text-ros-alert" />
                      <span>
                        Changed sections: {version.changedSections.join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </Card>
  );
}
