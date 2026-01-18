import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";

interface DiffLine {
  type: "added" | "removed" | "context";
  lineNumber: number;
  content: string;
}

interface VersionMetadata {
  version: string;
  timestamp: string;
  author: string;
}

interface ComparisonData {
  fromVersionId: string;
  toVersionId: string;
  fromVersion: VersionMetadata;
  toVersion: VersionMetadata;
  diffSummary: string;
  addedLines: number;
  removedLines: number;
  comparedBy: string;
  diff: DiffLine[];
}

interface ArtifactComparisonViewerProps {
  artifactId: string;
  fromVersionId: string;
  toVersionId: string;
  onClose: () => void;
}

// Mock data for demonstration
const createMockComparisonData = (
  _artifactId: string,
  fromVersionId: string,
  toVersionId: string
): ComparisonData => ({
  fromVersionId,
  toVersionId,
  fromVersion: {
    version: "v3.0.0",
    timestamp: "2024-01-13 11:00:00",
    author: "Dr. Sarah Chen",
  },
  toVersion: {
    version: "v3.2.1",
    timestamp: "2024-01-15 09:42:15",
    author: "Dr. Sarah Chen",
  },
  diffSummary: "Updated data validation rules and PHI masking improvements",
  addedLines: 47,
  removedLines: 12,
  comparedBy: "dev-user",
  diff: [
    { type: "context", lineNumber: 1, content: "import pandas as pd" },
    { type: "context", lineNumber: 2, content: "import numpy as np" },
    {
      type: "removed",
      lineNumber: 3,
      content: "def validate_data_old():",
    },
    {
      type: "added",
      lineNumber: 3,
      content: "def validate_data():",
    },
    {
      type: "removed",
      lineNumber: 4,
      content: '    """Validate with basic checks only"""',
    },
    {
      type: "added",
      lineNumber: 4,
      content: '    """Validate with enhanced PHI detection and masking"""',
    },
    { type: "context", lineNumber: 5, content: "    df = load_data()" },
    {
      type: "removed",
      lineNumber: 6,
      content: "    return df  # No processing",
    },
    {
      type: "added",
      lineNumber: 6,
      content: "    mask_phi_markers(df)",
    },
    {
      type: "added",
      lineNumber: 7,
      content: "    validate_checksums(df)",
    },
    {
      type: "added",
      lineNumber: 8,
      content: "    return df",
    },
    { type: "context", lineNumber: 9, content: "" },
    {
      type: "context",
      lineNumber: 10,
      content: "def mask_phi_markers(df):",
    },
    {
      type: "added",
      lineNumber: 11,
      content: '    """Remove protected health information markers"""',
    },
    {
      type: "context",
      lineNumber: 12,
      content: "    return df.replace(PHI_PATTERNS, '')",
    },
  ],
});

export function ArtifactComparisonViewer({
  artifactId: _artifactId,
  fromVersionId,
  toVersionId,
  onClose,
}: ArtifactComparisonViewerProps) {
  const [isOpen, setIsOpen] = useState(true);

  const comparisonMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/ros/artifact/${_artifactId}/compare`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-role": "RESEARCHER",
          },
          credentials: "include",
          body: JSON.stringify({
            fromVersionId,
            toVersionId,
            diffSummary: "",
            addedLines: 0,
            removedLines: 0,
            comparedBy: "dev-user",
          }),
        }
      );

      if (!response.ok) {
        // For now, return mock data if API is not available
        return createMockComparisonData(
          _artifactId,
          fromVersionId,
          toVersionId
        );
      }

      return response.json();
    },
  });

  useEffect(() => {
    // Fetch comparison data when component mounts
    comparisonMutation.mutate();
  }, [_artifactId, fromVersionId, toVersionId]);

  const handleClose = () => {
    setIsOpen(false);
    onClose();
  };

  const data =
    comparisonMutation.data ||
    createMockComparisonData(_artifactId, fromVersionId, toVersionId);
  const isLoading = comparisonMutation.isPending;
  const error = comparisonMutation.error;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col gap-0"
        data-testid="dialog-artifact-comparison"
      >
        <DialogHeader className="px-6 py-4 border-b border-border/30">
          <DialogTitle className="text-2xl">Version Comparison</DialogTitle>
        </DialogHeader>

        {isLoading && !data ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-ros-primary" />
              <p className="text-muted-foreground">Loading comparison data...</p>
            </div>
          </div>
        ) : error && !data ? (
          <div className="flex-1 flex items-center justify-center py-12 px-6">
            <Card className="p-6 border-ros-alert/30 bg-ros-alert/5 max-w-sm w-full">
              <p className="text-sm text-muted-foreground text-center">
                Failed to load comparison data. Please try again.
              </p>
            </Card>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-6 px-6 py-6">
            {/* Summary Stats Card */}
            <Card className="p-6 border-border/50 space-y-4">
              <div>
                <h3
                  className="font-semibold text-lg mb-2"
                  data-testid="text-diff-summary"
                >
                  {data.diffSummary}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Comparing versions{" "}
                  <Badge variant="secondary">{data.fromVersion.version}</Badge>{" "}
                  <span className="text-muted-foreground mx-2">→</span>
                  <Badge variant="secondary">{data.toVersion.version}</Badge>
                </p>
              </div>

              {/* Summary Statistics */}
              <div className="grid grid-cols-3 gap-4 pt-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                  data-testid="stat-added-lines"
                >
                  <Plus className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <div>
                    <div className="text-xl font-bold text-green-600 dark:text-green-400">
                      {data.addedLines}
                    </div>
                    <div className="text-xs text-muted-foreground">Added</div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                  data-testid="stat-removed-lines"
                >
                  <Minus className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <div>
                    <div className="text-xl font-bold text-red-600 dark:text-red-400">
                      {data.removedLines}
                    </div>
                    <div className="text-xs text-muted-foreground">Removed</div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/50 border border-border/30"
                  data-testid="stat-total-changes"
                >
                  <div>
                    <div className="text-xl font-bold">
                      {data.addedLines + data.removedLines}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Total Changes
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Version Metadata */}
              <div className="grid grid-cols-2 gap-6 pt-6 border-t border-border/30">
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold mb-3 text-muted-foreground">
                      FROM VERSION
                    </h4>
                    <div className="space-y-2">
                      <div className="text-sm">
                        <span className="font-medium text-foreground">
                          {data.fromVersion.version}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Author:</span>{" "}
                        {data.fromVersion.author}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Date:</span>{" "}
                        {data.fromVersion.timestamp}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold mb-3 text-muted-foreground">
                      TO VERSION
                    </h4>
                    <div className="space-y-2">
                      <div className="text-sm">
                        <span className="font-medium text-foreground">
                          {data.toVersion.version}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Author:</span>{" "}
                        {data.toVersion.author}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Date:</span>{" "}
                        {data.toVersion.timestamp}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Diff Content Section */}
            <section
              className="space-y-3"
              data-testid="section-diff-content"
            >
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Diff Preview
              </h3>

              <Card className="p-0 border-border/50 overflow-hidden shadow-sm">
                <div className="font-mono text-sm bg-background max-h-96 overflow-auto">
                  {data.diff.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground text-sm">
                      No differences between versions
                    </div>
                  ) : (
                    data.diff.map((line: DiffLine, idx: number) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          duration: 0.2,
                          delay: Math.min(idx * 0.02, 0.5),
                        }}
                        className={`flex border-b border-border/20 last:border-b-0 ${
                          line.type === "added"
                            ? "bg-green-100 dark:bg-green-900/15"
                            : line.type === "removed"
                              ? "bg-red-100 dark:bg-red-900/15"
                              : "bg-background hover:bg-muted/30"
                        }`}
                      >
                        {/* Line Number */}
                        <div
                          className="w-12 text-right pr-3 py-2 bg-muted/30 text-muted-foreground text-xs select-none border-r border-border/20 flex-shrink-0"
                          data-testid={`line-number-${idx}`}
                        >
                          {line.lineNumber}
                        </div>

                        {/* Change Indicator */}
                        <div
                          className="w-8 flex items-center justify-center text-sm font-bold py-2 px-2 flex-shrink-0"
                          data-testid={`line-marker-${idx}`}
                        >
                          {line.type === "added" ? (
                            <span className="text-green-600 dark:text-green-400">
                              +
                            </span>
                          ) : line.type === "removed" ? (
                            <span className="text-red-600 dark:text-red-400">
                              -
                            </span>
                          ) : (
                            <span className="text-muted-foreground"> </span>
                          )}
                        </div>

                        {/* Content */}
                        <div
                          className="flex-1 py-2 pr-4 overflow-x-auto whitespace-pre-wrap break-words text-foreground"
                          data-testid={`line-content-${idx}`}
                        >
                          {line.content || "\u00A0"}
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </Card>
            </section>

            {/* Additional Information */}
            <Card className="p-4 bg-muted/30 border-border/50 space-y-2">
              <div className="text-xs text-muted-foreground space-y-1">
                <div>
                  <span className="font-medium">Comparison ID:</span> {_artifactId}
                </div>
                <div>
                  <span className="font-medium">Compared by:</span>{" "}
                  {data.comparedBy}
                </div>
              </div>
            </Card>
          </div>
        )}

        <DialogFooter className="px-6 py-4 border-t border-border/30">
          <Button variant="outline" onClick={handleClose} data-testid="button-close-comparison">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
