import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Copy,
  Check,
  GitBranch,
  Clock,
  User,
  Hash,
  FileBox,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProvenanceEntry {
  artifactId: string;
  filename: string;
  sha256: string;
  sizeBytes: number;
  createdAt: string;
  createdBy: string;
  lineageParent?: string | null;
}

interface ProvenanceSummaryProps {
  entries: ProvenanceEntry[];
  runId: string;
  pipelineVersion: string;
  isStandbyMode?: boolean;
}

function CopyHashButton({ hash, label }: { hash: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      toast({
        title: "Hash Copied",
        description: `${label || "Hash"} copied to clipboard`,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleCopy}
          data-testid={`button-copy-hash-${hash.slice(0, 8)}`}
        >
          {copied ? (
            <Check className="h-3 w-3 text-ros-success" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Copy full hash for verification</TooltipContent>
    </Tooltip>
  );
}

function ProvenanceEntryCard({
  entry,
  isStandbyMode,
}: {
  entry: ProvenanceEntry;
  isStandbyMode?: boolean;
}) {
  return (
    <div
      className="p-4 rounded-lg border bg-card space-y-3"
      data-testid={`provenance-entry-${entry.artifactId}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileBox className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="font-medium text-sm truncate">{entry.filename}</span>
        </div>
        <CopyHashButton hash={entry.sha256} label={entry.filename} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Hash className="h-3 w-3" />
          <code className="font-mono truncate">{entry.sha256.slice(0, 24)}...</code>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{new Date(entry.createdAt).toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <User className="h-3 w-3" />
          <span>{entry.createdBy}</span>
        </div>
        {entry.lineageParent && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <GitBranch className="h-3 w-3" />
            <code className="font-mono truncate">{entry.lineageParent.slice(0, 16)}...</code>
          </div>
        )}
      </div>

      {isStandbyMode && (
        <div className="flex items-center gap-2 pt-2 border-t text-xs text-muted-foreground">
          <Shield className="h-3 w-3" />
          <span>Content hidden in STANDBY mode (metadata only)</span>
        </div>
      )}
    </div>
  );
}

export function ProvenanceSummary({
  entries,
  runId,
  pipelineVersion,
  isStandbyMode = true,
}: ProvenanceSummaryProps) {
  return (
    <Card data-testid="provenance-summary-card">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Provenance Summary
            </CardTitle>
            <CardDescription>
              Metadata lineage for reproducibility verification
            </CardDescription>
          </div>
          {isStandbyMode && (
            <Badge
              variant="outline"
              className="bg-amber-500/10 text-amber-600 border-amber-500/30"
            >
              <AlertTriangle className="h-3 w-3 mr-1" />
              STANDBY
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 flex-wrap text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Run ID:</span>
            <code className="font-mono text-xs bg-muted px-2 py-1 rounded">
              {runId}
            </code>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Pipeline:</span>
            <Badge variant="secondary">v{pipelineVersion}</Badge>
          </div>
        </div>

        {isStandbyMode && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  STANDBY Mode Active
                </p>
                <p className="text-amber-600 dark:text-amber-500 text-xs mt-1">
                  Only metadata is displayed. Artifact content is not accessible
                  in STANDBY mode. Use hashes for verification.
                </p>
              </div>
            </div>
          </div>
        )}

        {entries.length > 0 ? (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {entries.map((entry) => (
                <ProvenanceEntryCard
                  key={entry.artifactId}
                  entry={entry}
                  isStandbyMode={isStandbyMode}
                />
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <FileBox className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No provenance entries available</p>
            <p className="text-sm">Artifacts will appear here after pipeline execution</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
