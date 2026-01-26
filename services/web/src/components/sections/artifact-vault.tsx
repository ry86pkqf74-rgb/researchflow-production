import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Database, FileCode, Settings, FileText, Download, Package, Clock, User, History, AlertCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

interface Artifact {
  id: string;
  type: "dataset" | "configuration" | "pipeline" | "output";
  name: string;
  version: string;
  hash: string;
  timestamp: string;
  author: string;
  status: "active" | "archived" | "superseded";
  description: string;
  hasVersions?: boolean;
}

interface ArtifactVersion {
  id: string;
  version: string;
  hash: string;
  timestamp: string;
  author: string;
  status: "active" | "archived" | "superseded";
  changeDescription: string;
}

interface ApiArtifact {
  id: string;
  artifact_type?: string;
  type?: string;
  name: string;
  version: string;
  hash?: string;
  sha256_hash?: string;
  timestamp?: string;
  created_at?: string;
  author?: string;
  created_by?: string;
  status: string;
  description: string;
  has_versions?: boolean;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  dataset: Database,
  configuration: FileCode,
  pipeline: Settings,
  output: FileText,
};

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  active: {
    bg: "bg-ros-primary/10",
    text: "text-ros-primary",
    border: "border-ros-primary/20",
  },
  archived: {
    bg: "bg-muted/40",
    text: "text-muted-foreground",
    border: "border-muted/20",
  },
  superseded: {
    bg: "bg-ros-alert/10",
    text: "text-ros-alert",
    border: "border-ros-alert/20",
  },
};

const demoArtifacts: Artifact[] = [
  {
    id: "dataset-v3",
    type: "dataset",
    name: "Thyroid Clinical Data",
    version: "v3.2.1",
    hash: "a7f3c9e2",
    timestamp: "2024-01-15 09:42:15",
    author: "Dr. Sarah Chen",
    status: "active",
    description: "Final cleaned dataset with 2,847 patient records",
    hasVersions: true,
  },
  {
    id: "config-snapshot-1",
    type: "configuration",
    name: "Model Configuration Snapshot",
    version: "v1.0",
    hash: "b2d4e5f1",
    timestamp: "2024-01-15 09:38:22",
    author: "System",
    status: "active",
    description: "ML model parameters: learning_rate=0.001, batch_size=32",
    hasVersions: false,
  },
  {
    id: "dataset-v2",
    type: "dataset",
    name: "Thyroid Clinical Data",
    version: "v3.1.0",
    hash: "c8f2a1d7",
    timestamp: "2024-01-14 14:23:45",
    author: "Dr. Sarah Chen",
    status: "superseded",
    description: "Intermediate version with partial PHI removal",
    hasVersions: true,
  },
  {
    id: "pipeline-log-1",
    type: "pipeline",
    name: "Data Validation Pipeline",
    version: "run-2024-01-15",
    hash: "d3e6f9a4",
    timestamp: "2024-01-15 09:35:10",
    author: "System",
    status: "active",
    description: "Pipeline execution: 156 checks passed, 0 failed",
    hasVersions: false,
  },
  {
    id: "output-table-1",
    type: "output",
    name: "Table 1: Baseline Characteristics",
    version: "v1.2",
    hash: "e1f7c2b8",
    timestamp: "2024-01-15 09:30:05",
    author: "Dr. James Wilson",
    status: "active",
    description: "Demographic summary statistics with p-values",
    hasVersions: true,
  },
  {
    id: "config-snapshot-0",
    type: "configuration",
    name: "Model Configuration Snapshot",
    version: "v0.9",
    hash: "f4a9d1e6",
    timestamp: "2024-01-14 16:15:30",
    author: "System",
    status: "archived",
    description: "Previous configuration: learning_rate=0.002, batch_size=64",
    hasVersions: false,
  },
  {
    id: "dataset-v1",
    type: "dataset",
    name: "Thyroid Clinical Data",
    version: "v3.0.0",
    hash: "g7c3e5f2",
    timestamp: "2024-01-13 11:00:00",
    author: "Dr. Sarah Chen",
    status: "archived",
    description: "Initial raw dataset import, pre-cleaning",
    hasVersions: true,
  },
  {
    id: "output-figure-1",
    type: "output",
    name: "Figure 2: Distribution Analysis",
    version: "v1.0",
    hash: "h2b8a4d9",
    timestamp: "2024-01-15 09:28:15",
    author: "Dr. Jane Doe",
    status: "active",
    description: "Patient age and TSH level distribution plots",
    hasVersions: false,
  },
];

function transformApiArtifact(apiArtifact: ApiArtifact): Artifact {
  return {
    id: apiArtifact.id,
    type: (apiArtifact.artifact_type || apiArtifact.type || "output") as Artifact["type"],
    name: apiArtifact.name,
    version: apiArtifact.version,
    hash: (apiArtifact.hash || apiArtifact.sha256_hash || "").substring(0, 8),
    timestamp: apiArtifact.timestamp || apiArtifact.created_at || new Date().toISOString(),
    author: apiArtifact.author || apiArtifact.created_by || "System",
    status: apiArtifact.status as Artifact["status"],
    description: apiArtifact.description,
    hasVersions: apiArtifact.has_versions ?? false,
  };
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

interface ArtifactVaultProps {
  researchId?: string;
}

export function ArtifactVault({ researchId = "DEMO-001" }: ArtifactVaultProps) {
  const isDemoMode = researchId === "DEMO-001";
  const [isExporting, setIsExporting] = useState(false);
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);

  const { data: apiArtifacts, isLoading, error } = useQuery<ApiArtifact[]>({
    queryKey: ["/api/ros/artifacts", researchId],
    retry: false,
  });

  const { data: versions, isLoading: isLoadingVersions } = useQuery<ArtifactVersion[]>({
    queryKey: ["/api/ros/artifact", selectedArtifact?.id, "versions"],
    enabled: versionDialogOpen && !!selectedArtifact?.id,
    retry: false,
  });

  const artifacts: Artifact[] = apiArtifacts && apiArtifacts.length > 0
    ? apiArtifacts.map(transformApiArtifact)
    : (isDemoMode ? demoArtifacts : []);

  const handleExportReproducibility = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(
        `/api/ros/export/reproducibility-bundle/${researchId}?format=zip`,
        {
          method: "GET",
          headers: {
            "x-user-role": "RESEARCHER",
          },
          credentials: "include",
        }
      );
      
      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reproducibility-bundle-${researchId}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Failed to export reproducibility bundle:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleViewVersions = (artifact: Artifact) => {
    setSelectedArtifact(artifact);
    setVersionDialogOpen(true);
  };

  if (isLoading) {
    return (
      <section className="py-16 lg:py-24 bg-muted/30" data-testid="section-artifact-vault-loading">
        <div className="container mx-auto px-6 lg:px-24">
          <div className="text-center mb-12">
            <Skeleton className="h-8 w-40 mx-auto mb-4" />
            <Skeleton className="h-12 w-96 mx-auto mb-4" />
            <Skeleton className="h-6 w-80 mx-auto" />
          </div>
          <Card className="p-6 lg:p-8 border-border/50">
            <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
              <Skeleton className="h-8 w-40" />
              <div className="flex gap-3">
                <Skeleton className="h-9 w-40" />
                <Skeleton className="h-9 w-44" />
              </div>
            </div>
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-28 w-full" />
              ))}
            </div>
          </Card>
        </div>
      </section>
    );
  }

  if (error && !apiArtifacts) {
    return (
      <section className="py-16 lg:py-24 bg-muted/30" data-testid="section-artifact-vault">
        <div className="container mx-auto px-6 lg:px-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12 lg:mb-16"
          >
            <Badge
              variant="secondary"
              className="mb-4 px-4 py-1.5 bg-ros-primary/10 text-ros-primary border-ros-primary/20"
              data-testid="badge-artifact-vault-section"
            >
              Artifact Traceability
            </Badge>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground mb-4" data-testid="text-artifact-heading">
              Research Artifact Audit Trail
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-artifact-description">
              Complete versioning and traceability of all research artifacts. Track dataset
              changes, configuration snapshots, pipeline executions, and generated outputs
              with SHA-256 verification and author attribution.
            </p>
          </motion.div>

          {isDemoMode ? (
            <>
              <Card className="p-6 mb-6 border-ros-alert/30 bg-ros-alert/5 text-center" data-testid="card-artifact-error">
                <AlertCircle className="h-8 w-8 text-ros-alert mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Unable to load artifacts from API. Showing demo data.</p>
              </Card>

              <ArtifactList
                artifacts={demoArtifacts}
                isExporting={isExporting}
                onExportReproducibility={handleExportReproducibility}
                onViewVersions={handleViewVersions}
              />
            </>
          ) : (
            <Card className="p-6 text-center border-ros-alert/30 bg-ros-alert/5" data-testid="card-artifact-error">
              <AlertCircle className="h-8 w-8 text-ros-alert mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Failed to load artifacts. Please try again.</p>
            </Card>
          )}
        </div>

        <VersionHistoryDialog
          open={versionDialogOpen}
          onOpenChange={setVersionDialogOpen}
          artifact={selectedArtifact}
          versions={versions}
          isLoading={isLoadingVersions}
        />
      </section>
    );
  }

  if (!isLoading && artifacts.length === 0 && !isDemoMode) {
    return (
      <section className="py-16 lg:py-24 bg-muted/30" data-testid="section-artifact-vault">
        <div className="container mx-auto px-6 lg:px-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12 lg:mb-16"
          >
            <Badge
              variant="secondary"
              className="mb-4 px-4 py-1.5 bg-ros-primary/10 text-ros-primary border-ros-primary/20"
              data-testid="badge-artifact-vault-section"
            >
              Artifact Traceability
            </Badge>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground mb-4" data-testid="text-artifact-heading">
              Research Artifact Audit Trail
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-artifact-description">
              Complete versioning and traceability of all research artifacts. Track dataset
              changes, configuration snapshots, pipeline executions, and generated outputs
              with SHA-256 verification and author attribution.
            </p>
          </motion.div>

          <Card className="p-8 text-center" data-testid="card-no-artifacts">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-foreground">No artifacts found for this research project</h3>
            <p className="text-muted-foreground">Once your research project processes data, artifacts will appear here.</p>
          </Card>
        </div>

        <VersionHistoryDialog
          open={versionDialogOpen}
          onOpenChange={setVersionDialogOpen}
          artifact={selectedArtifact}
          versions={versions}
          isLoading={isLoadingVersions}
        />
      </section>
    );
  }

  return (
    <section className="py-16 lg:py-24 bg-muted/30" data-testid="section-artifact-vault">
      <div className="container mx-auto px-6 lg:px-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 lg:mb-16"
        >
          <Badge
            variant="secondary"
            className="mb-4 px-4 py-1.5 bg-ros-primary/10 text-ros-primary border-ros-primary/20"
            data-testid="badge-artifact-vault-section"
          >
            Artifact Traceability
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground mb-4" data-testid="text-artifact-heading">
            Research Artifact Audit Trail
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-artifact-description">
            Complete versioning and traceability of all research artifacts. Track dataset
            changes, configuration snapshots, pipeline executions, and generated outputs
            with SHA-256 verification and author attribution.
          </p>
        </motion.div>

        <ArtifactList
          artifacts={artifacts}
          isExporting={isExporting}
          onExportReproducibility={handleExportReproducibility}
          onViewVersions={handleViewVersions}
        />
      </div>

      <VersionHistoryDialog
        open={versionDialogOpen}
        onOpenChange={setVersionDialogOpen}
        artifact={selectedArtifact}
        versions={versions}
        isLoading={isLoadingVersions}
      />
    </section>
  );
}

interface ArtifactListProps {
  artifacts: Artifact[];
  isExporting: boolean;
  onExportReproducibility: () => void;
  onViewVersions: (artifact: Artifact) => void;
}

function ArtifactList({
  artifacts,
  isExporting,
  onExportReproducibility,
  onViewVersions,
}: ArtifactListProps) {
  return (
    <>
      <div className="mb-12">
        <Card className="p-6 lg:p-8 border-border/50" data-testid="card-artifact-timeline">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
            <h3 className="text-xl font-semibold" data-testid="text-timeline-title">
              Artifact Timeline
            </h3>
            <div className="flex gap-3 flex-wrap" data-testid="list-timeline-actions">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                data-testid="button-download-audit"
              >
                <Download className="h-4 w-4" />
                Download Audit Report
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={onExportReproducibility}
                disabled={isExporting}
                data-testid="button-export-reproducibility-bundle"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Package className="h-4 w-4" />
                )}
                {isExporting ? "Exporting..." : "Export Reproducibility"}
              </Button>
            </div>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="space-y-4"
            data-testid="list-artifacts"
          >
            {artifacts.map((artifact, index) => {
              const IconComponent = iconMap[artifact.type] || FileText;
              const colorScheme = statusColors[artifact.status];

              return (
                <motion.div key={artifact.id} variants={itemVariants}>
                  <Card
                    className={`
                      p-4 lg:p-5 border transition-all hover-elevate
                      ${artifact.status === "active" ? "border-border/50" : "border-border/30"}
                    `}
                    data-testid={`artifact-${artifact.type}-${index}`}
                  >
                    <div className="flex gap-4 items-start">
                      <div
                        className={`
                          w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0
                          ${
                            artifact.status === "active"
                              ? "bg-ros-primary/10 text-ros-primary"
                              : "bg-muted/50 text-muted-foreground"
                          }
                        `}
                        data-testid={`icon-artifact-${artifact.type}-${index}`}
                      >
                        <IconComponent className="h-6 w-6" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h4
                                className={`font-semibold ${
                                  artifact.status === "active" ? "text-foreground" : "text-muted-foreground"
                                }`}
                                data-testid={`text-artifact-name-${index}`}
                              >
                                {artifact.name}
                              </h4>
                              <Badge
                                variant="secondary"
                                className="text-xs px-2 py-0.5"
                                data-testid={`badge-artifact-version-${index}`}
                              >
                                {artifact.version}
                              </Badge>
                              {artifact.hasVersions && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs gap-1"
                                  onClick={() => onViewVersions(artifact)}
                                  data-testid={`button-view-versions-${index}`}
                                >
                                  <History className="h-3 w-3" />
                                  View Versions
                                </Button>
                              )}
                            </div>
                            <p
                              className="text-sm text-muted-foreground"
                              data-testid={`text-artifact-description-${index}`}
                            >
                              {artifact.description}
                            </p>
                          </div>

                          <Badge
                            className={`whitespace-nowrap text-xs ${colorScheme.bg} ${colorScheme.text} ${colorScheme.border}`}
                            data-testid={`badge-artifact-status-${index}`}
                          >
                            {artifact.status.charAt(0).toUpperCase() + artifact.status.slice(1)}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-border/30">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid={`fingerprint-${index}`}>
                            <span className="font-mono font-semibold">SHA-256:</span>
                            <code className="bg-muted/50 px-2 py-1 rounded text-foreground">
                              {artifact.hash}...
                            </code>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid={`timestamp-${index}`}>
                            <Clock className="h-3.5 w-3.5" />
                            <span>{artifact.timestamp}</span>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid={`author-${index}`}>
                            <User className="h-3.5 w-3.5" />
                            <span>{artifact.author}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-8 pt-8 border-t border-border/50"
          >
            <div className="flex flex-col sm:flex-row gap-4 justify-center" data-testid="list-summary-stats">
              <div className="flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-ros-primary/5" data-testid="stat-total-artifacts">
                <div className="text-center">
                  <div className="text-2xl font-bold text-ros-primary">
                    {artifacts.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Artifacts</div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-ros-success/5" data-testid="stat-active-artifacts">
                <div className="text-center">
                  <div className="text-2xl font-bold text-ros-success">
                    {artifacts.filter((a) => a.status === "active").length}
                  </div>
                  <div className="text-xs text-muted-foreground">Active</div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-ros-alert/5" data-testid="stat-superseded-artifacts">
                <div className="text-center">
                  <div className="text-2xl font-bold text-ros-alert">
                    {artifacts.filter((a) => a.status === "superseded").length}
                  </div>
                  <div className="text-xs text-muted-foreground">Superseded</div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-muted/40" data-testid="stat-archived-artifacts">
                <div className="text-center">
                  <div className="text-2xl font-bold text-muted-foreground">
                    {artifacts.filter((a) => a.status === "archived").length}
                  </div>
                  <div className="text-xs text-muted-foreground">Archived</div>
                </div>
              </div>
            </div>
          </motion.div>
        </Card>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="grid lg:grid-cols-2 gap-6"
      >
        <Card className="p-6 border-border/50" data-testid="card-reproducibility-info">
          <h3 className="font-semibold text-lg mb-4" data-testid="text-reproducibility-title">
            Reproducibility Package
          </h3>
          <ul className="space-y-3" data-testid="list-package-contents">
            {[
              "All dataset versions with versioning metadata",
              "Complete configuration snapshots for reproducibility",
              "Full pipeline execution logs and performance metrics",
              "Generated outputs with quality checksums",
              "SHA-256 hashes for integrity verification",
              "Author attribution and timestamp records",
            ].map((item, idx) => (
              <li
                key={idx}
                className="flex gap-3 items-start text-sm"
                data-testid={`package-item-${idx}`}
              >
                <span className="text-ros-success mt-1">✓</span>
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-6 border-border/50" data-testid="card-audit-features">
          <h3 className="font-semibold text-lg mb-4" data-testid="text-audit-features-title">
            Audit Trail Features
          </h3>
          <ul className="space-y-3" data-testid="list-audit-features">
            {[
              "Immutable artifact versioning with full history",
              "Cryptographic hashing for data integrity",
              "Timestamped entries with UTC precision",
              "User attribution for all modifications",
              "Status tracking (Active, Archived, Superseded)",
              "Export-ready audit reports for compliance",
            ].map((item, idx) => (
              <li
                key={idx}
                className="flex gap-3 items-start text-sm"
                data-testid={`audit-feature-${idx}`}
              >
                <span className="text-ros-primary mt-1">✓</span>
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      </motion.div>
    </>
  );
}

interface VersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artifact: Artifact | null;
  versions: ArtifactVersion[] | undefined;
  isLoading: boolean;
}

function VersionHistoryDialog({
  open,
  onOpenChange,
  artifact,
  versions,
  isLoading,
}: VersionHistoryDialogProps) {
  const demoVersions: ArtifactVersion[] = artifact ? [
    {
      id: `${artifact.id}-v3`,
      version: artifact.version,
      hash: artifact.hash,
      timestamp: artifact.timestamp,
      author: artifact.author,
      status: artifact.status,
      changeDescription: "Current version",
    },
    {
      id: `${artifact.id}-v2`,
      version: artifact.version.replace(/\d+$/, (m) => String(Math.max(0, parseInt(m) - 1))),
      hash: "prev" + artifact.hash.substring(4),
      timestamp: "2024-01-14 16:30:00",
      author: artifact.author,
      status: "superseded",
      changeDescription: "Updated data cleaning parameters",
    },
    {
      id: `${artifact.id}-v1`,
      version: artifact.version.replace(/\d+$/, (m) => String(Math.max(0, parseInt(m) - 2))),
      hash: "init" + artifact.hash.substring(4),
      timestamp: "2024-01-13 10:00:00",
      author: artifact.author,
      status: "archived",
      changeDescription: "Initial version",
    },
  ] : [];

  const displayVersions = versions && versions.length > 0 ? versions : demoVersions;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-version-history">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </DialogTitle>
          <DialogDescription>
            {artifact ? `Showing version history for "${artifact.name}"` : "Select an artifact to view versions"}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3" data-testid="list-version-history">
              {displayVersions.map((version, index) => {
                const colorScheme = statusColors[version.status] || statusColors.active;
                
                return (
                  <Card
                    key={version.id}
                    className={`p-4 border ${index === 0 ? "border-ros-primary/30 bg-ros-primary/5" : "border-border/50"}`}
                    data-testid={`version-item-${index}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            {version.version}
                          </Badge>
                          <Badge className={`text-xs ${colorScheme.bg} ${colorScheme.text} ${colorScheme.border}`}>
                            {version.status.charAt(0).toUpperCase() + version.status.slice(1)}
                          </Badge>
                          {index === 0 && (
                            <Badge className="text-xs bg-ros-success/10 text-ros-success border-ros-success/20">
                              Current
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {version.changeDescription}
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground flex-shrink-0">
                        <div className="flex items-center gap-1 mb-1 justify-end">
                          <Clock className="h-3 w-3" />
                          {version.timestamp}
                        </div>
                        <div className="flex items-center gap-1 justify-end">
                          <User className="h-3 w-3" />
                          {version.author}
                        </div>
                        <code className="text-xs mt-1 inline-block bg-muted/50 px-1 rounded">
                          {version.hash}...
                        </code>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
