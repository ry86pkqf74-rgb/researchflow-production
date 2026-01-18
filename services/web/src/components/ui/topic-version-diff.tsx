import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GitCompare, Clock, Hash, ArrowRight, Plus, Minus, Loader2, AlertCircle } from "lucide-react";
import type { TopicVersion, TopicScopeValues, ExtendedTopicFields } from "@packages/core/types";

interface VersionHistoryResponse {
  topicId: string;
  currentVersion: number;
  currentHash: string;
  history: TopicVersion[];
  mode: string;
}

interface TopicVersionDiffProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  v1: TopicVersion | null;
  v2: TopicVersion | null;
}

interface TopicVersionDiffWithAPIProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicId: string;
  initialV1?: number;
  initialV2?: number;
}

interface DiffFieldProps {
  label: string;
  oldValue: string | string[] | undefined;
  newValue: string | string[] | undefined;
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

function formatHash(hash: string | undefined): string {
  if (!hash) return "N/A";
  return hash.slice(0, 12) + "...";
}

function getChangeTypeBadgeVariant(changeType: string): "default" | "secondary" | "destructive" | "outline" {
  switch (changeType) {
    case "initial":
      return "default";
    case "refinement":
      return "secondary";
    case "major_revision":
      return "destructive";
    case "ai_suggestion":
      return "outline";
    default:
      return "secondary";
  }
}

function normalizeValue(value: string | string[] | undefined): string {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return value;
}

function DiffField({ label, oldValue, newValue }: DiffFieldProps) {
  const oldNormalized = normalizeValue(oldValue);
  const newNormalized = normalizeValue(newValue);
  const hasChanged = oldNormalized !== newNormalized;
  const isAddition = !oldNormalized && newNormalized;
  const isRemoval = oldNormalized && !newNormalized;

  if (!oldNormalized && !newNormalized) {
    return null;
  }

  return (
    <div className="space-y-2" data-testid={`diff-field-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {hasChanged && (
          <Badge 
            variant="outline" 
            className={`text-[10px] px-1.5 py-0.5 ${
              isAddition 
                ? "bg-green-500/10 text-green-600 border-green-500/30" 
                : isRemoval 
                  ? "bg-red-500/10 text-red-600 border-red-500/30"
                  : "bg-amber-500/10 text-amber-600 border-amber-500/30"
            }`}
          >
            {isAddition ? "Added" : isRemoval ? "Removed" : "Changed"}
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div 
          className={`p-3 rounded-md text-sm ${
            hasChanged && !isAddition 
              ? "bg-red-500/5 border border-red-500/20" 
              : "bg-muted/50 border border-transparent"
          }`}
        >
          {oldNormalized ? (
            <span className={hasChanged && !isAddition ? "text-red-600 dark:text-red-400" : ""}>
              {hasChanged && !isAddition && <Minus className="inline h-3 w-3 mr-1" />}
              {oldNormalized}
            </span>
          ) : (
            <span className="text-muted-foreground italic">Not specified</span>
          )}
        </div>
        <div 
          className={`p-3 rounded-md text-sm ${
            hasChanged && !isRemoval 
              ? "bg-green-500/5 border border-green-500/20" 
              : "bg-muted/50 border border-transparent"
          }`}
        >
          {newNormalized ? (
            <span className={hasChanged && !isRemoval ? "text-green-600 dark:text-green-400" : ""}>
              {hasChanged && !isRemoval && <Plus className="inline h-3 w-3 mr-1" />}
              {newNormalized}
            </span>
          ) : (
            <span className="text-muted-foreground italic">Not specified</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ArrayDiffField({ label, oldValue, newValue }: DiffFieldProps) {
  const oldArray = Array.isArray(oldValue) ? oldValue : oldValue ? [oldValue] : [];
  const newArray = Array.isArray(newValue) ? newValue : newValue ? [newValue] : [];
  
  const added = newArray.filter(item => !oldArray.includes(item));
  const removed = oldArray.filter(item => !newArray.includes(item));
  
  const hasChanges = added.length > 0 || removed.length > 0;

  if (oldArray.length === 0 && newArray.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2" data-testid={`diff-array-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {hasChanges && (
          <Badge 
            variant="outline" 
            className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-600 border-amber-500/30"
          >
            {added.length > 0 && removed.length > 0 
              ? `+${added.length} / -${removed.length}` 
              : added.length > 0 
                ? `+${added.length} added` 
                : `-${removed.length} removed`}
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 rounded-md bg-muted/50 text-sm space-y-1">
          {oldArray.length > 0 ? (
            oldArray.map((item, idx) => (
              <div 
                key={idx} 
                className={`flex items-center gap-1 ${
                  removed.includes(item) ? "text-red-600 dark:text-red-400" : ""
                }`}
              >
                {removed.includes(item) && <Minus className="h-3 w-3" />}
                <span>{item}</span>
              </div>
            ))
          ) : (
            <span className="text-muted-foreground italic">None</span>
          )}
        </div>
        <div className="p-3 rounded-md bg-muted/50 text-sm space-y-1">
          {newArray.length > 0 ? (
            newArray.map((item, idx) => (
              <div 
                key={idx} 
                className={`flex items-center gap-1 ${
                  added.includes(item) ? "text-green-600 dark:text-green-400" : ""
                }`}
              >
                {added.includes(item) && <Plus className="h-3 w-3" />}
                <span>{item}</span>
              </div>
            ))
          ) : (
            <span className="text-muted-foreground italic">None</span>
          )}
        </div>
      </div>
    </div>
  );
}

function VersionInfoCard({ version, label }: { version: TopicVersion; label: string }) {
  return (
    <div className="p-4 rounded-lg border bg-card" data-testid={`version-info-${label}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold">Version {version.version}</span>
        <Badge variant={getChangeTypeBadgeVariant(version.changeType)}>
          {version.changeType.replace("_", " ")}
        </Badge>
      </div>
      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" />
          <span>{formatTimestamp(version.timestamp)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Hash className="h-3.5 w-3.5" />
          <span className="font-mono text-xs">{formatHash(version.sha256Hash)}</span>
        </div>
        {version.changeDescription && (
          <p className="mt-2 text-xs italic">{version.changeDescription}</p>
        )}
      </div>
    </div>
  );
}

function VersionDiffContent({ v1, v2 }: { v1: TopicVersion; v2: TopicVersion }) {
  const picoFields: { key: keyof TopicScopeValues; label: string }[] = [
    { key: "population", label: "Population" },
    { key: "intervention", label: "Intervention" },
    { key: "comparator", label: "Comparator" },
    { key: "outcomes", label: "Outcomes" },
    { key: "timeframe", label: "Timeframe" },
  ];

  const extendedStringFields: { key: keyof ExtendedTopicFields; label: string }[] = [
    { key: "datasetSource", label: "Dataset Source" },
    { key: "constraints", label: "Constraints" },
  ];

  const extendedArrayFields: { key: keyof ExtendedTopicFields; label: string }[] = [
    { key: "covariates", label: "Covariates" },
    { key: "cohortInclusion", label: "Cohort Inclusion" },
    { key: "cohortExclusion", label: "Cohort Exclusion" },
    { key: "exposures", label: "Exposures" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <VersionInfoCard version={v1} label="v1" />
        <VersionInfoCard version={v2} label="v2" />
      </div>

      <div className="flex items-center gap-2 text-center justify-center text-xs text-muted-foreground">
        <span>Version {v1.version}</span>
        <ArrowRight className="h-4 w-4" />
        <span>Version {v2.version}</span>
      </div>

      <Separator />

      <div>
        <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
          PICO Elements
          <Badge variant="outline" className="text-[10px]">Research Scope</Badge>
        </h4>
        <div className="grid grid-cols-2 gap-2 mb-2 text-xs text-muted-foreground font-medium">
          <span>Previous (v{v1.version})</span>
          <span>Current (v{v2.version})</span>
        </div>
        <div className="space-y-4">
          {picoFields.map(({ key, label }) => (
            <DiffField
              key={key}
              label={label}
              oldValue={v1.scopeValues?.[key]}
              newValue={v2.scopeValues?.[key]}
            />
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
          Extended Fields
          <Badge variant="outline" className="text-[10px]">Additional Scope</Badge>
        </h4>
        <div className="grid grid-cols-2 gap-2 mb-2 text-xs text-muted-foreground font-medium">
          <span>Previous (v{v1.version})</span>
          <span>Current (v{v2.version})</span>
        </div>
        <div className="space-y-4">
          {extendedStringFields.map(({ key, label }) => (
            <DiffField
              key={key}
              label={label}
              oldValue={v1.extendedFields?.[key] as string | undefined}
              newValue={v2.extendedFields?.[key] as string | undefined}
            />
          ))}
          {extendedArrayFields.map(({ key, label }) => (
            <ArrayDiffField
              key={key}
              label={label}
              oldValue={v1.extendedFields?.[key] as string[] | undefined}
              newValue={v2.extendedFields?.[key] as string[] | undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TopicVersionDiff({ open, onOpenChange, v1, v2 }: TopicVersionDiffProps) {
  if (!v1 || !v2) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-4xl max-h-[85vh]" 
        data-testid="modal-version-diff"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-ros-primary" />
            Topic Version Comparison
          </DialogTitle>
          <DialogDescription>
            Comparing version {v1.version} to version {v2.version}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4">
          <VersionDiffContent v1={v1} v2={v2} />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export function TopicVersionDiffWithAPI({ 
  open, 
  onOpenChange, 
  topicId,
  initialV1,
  initialV2,
}: TopicVersionDiffWithAPIProps) {
  const [selectedV1, setSelectedV1] = useState<number | undefined>(initialV1);
  const [selectedV2, setSelectedV2] = useState<number | undefined>(initialV2);

  const { data: versionHistory, isLoading: historyLoading, error: historyError } = useQuery<VersionHistoryResponse>({
    queryKey: ['/api/ros/topics', topicId, 'versions'],
    queryFn: async () => {
      const res = await fetch(`/api/ros/topics/${topicId}/versions`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch version history');
      return res.json();
    },
    enabled: open && !!topicId,
    staleTime: 30000,
  });

  const v1Data = versionHistory?.history?.find(v => v.version === selectedV1);
  const v2Data = versionHistory?.history?.find(v => v.version === selectedV2);

  const canCompare = v1Data && v2Data && selectedV1 !== selectedV2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-4xl max-h-[85vh]" 
        data-testid="modal-version-diff-api"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-ros-primary" />
            Topic Version Comparison
          </DialogTitle>
          <DialogDescription>
            {canCompare 
              ? `Comparing version ${selectedV1} to version ${selectedV2}`
              : "Select two versions to compare"}
          </DialogDescription>
        </DialogHeader>

        {historyLoading ? (
          <div className="space-y-4 p-4">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading version history...</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          </div>
        ) : historyError ? (
          <div className="flex items-center justify-center gap-2 text-destructive p-4" data-testid="version-history-error">
            <AlertCircle className="h-4 w-4" />
            <span>Failed to load version history</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30" data-testid="version-selector">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  From Version
                </label>
                <Select 
                  value={selectedV1?.toString()} 
                  onValueChange={(val) => setSelectedV1(parseInt(val, 10))}
                >
                  <SelectTrigger data-testid="select-version-v1">
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    {versionHistory?.history?.map((v) => (
                      <SelectItem 
                        key={v.version} 
                        value={v.version.toString()}
                        disabled={v.version === selectedV2}
                      >
                        v{v.version} - {v.changeType.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <ArrowRight className="h-4 w-4 text-muted-foreground mt-5" />
              
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  To Version
                </label>
                <Select 
                  value={selectedV2?.toString()} 
                  onValueChange={(val) => setSelectedV2(parseInt(val, 10))}
                >
                  <SelectTrigger data-testid="select-version-v2">
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    {versionHistory?.history?.map((v) => (
                      <SelectItem 
                        key={v.version} 
                        value={v.version.toString()}
                        disabled={v.version === selectedV1}
                      >
                        v{v.version} - {v.changeType.replace("_", " ")}
                        {v.version === versionHistory.currentVersion && " (current)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ScrollArea className="max-h-[55vh] pr-4">
              {canCompare ? (
                <VersionDiffContent v1={v1Data} v2={v2Data} />
              ) : (
                <div className="flex items-center justify-center p-8 text-muted-foreground" data-testid="select-versions-prompt">
                  <p>Select two different versions above to compare their changes</p>
                </div>
              )}
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function useTopicVersionHistory(topicId: string | undefined) {
  return useQuery<VersionHistoryResponse>({
    queryKey: ['/api/ros/topics', topicId, 'versions'],
    queryFn: async () => {
      const res = await fetch(`/api/ros/topics/${topicId}/versions`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch version history');
      return res.json();
    },
    enabled: !!topicId,
    staleTime: 30000,
  });
}
