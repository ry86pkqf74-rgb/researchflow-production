import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  FileText,
  History,
  Lock,
  Copy,
  Check,
  Users,
  Beaker,
  Target,
  Clock,
  GitBranch,
  Shield,
  Database,
  UserCheck,
  UserX,
  FlaskConical,
  ListChecks,
  AlertCircle,
  Pencil,
  Save,
  X,
  GitCompare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { TopicVersion, TopicVersionHistory, TopicScopeValues, ExtendedTopicFields } from "@packages/core/types";
import { TopicVersionDiff } from "@/components/ui/topic-version-diff";

interface ResearchBriefPanelProps {
  versionHistory: TopicVersionHistory;
  onVersionSelect?: (version: number) => void;
  onLock?: () => void;
  onExtendedFieldsUpdate?: (fields: ExtendedTopicFields) => void;
  isLocked?: boolean;
}

const PICO_LABELS: Record<keyof TopicScopeValues, { label: string; icon: typeof Users }> = {
  population: { label: "Population", icon: Users },
  intervention: { label: "Intervention/Exposure", icon: Beaker },
  comparator: { label: "Comparator", icon: GitBranch },
  outcomes: { label: "Primary Outcomes", icon: Target },
  timeframe: { label: "Study Timeframe", icon: Clock },
};

const EXTENDED_FIELD_LABELS: Record<keyof ExtendedTopicFields, { label: string; icon: typeof Database; isArray: boolean }> = {
  datasetSource: { label: "Dataset Source", icon: Database, isArray: false },
  cohortInclusion: { label: "Inclusion Criteria", icon: UserCheck, isArray: true },
  cohortExclusion: { label: "Exclusion Criteria", icon: UserX, isArray: true },
  exposures: { label: "Exposure Variables", icon: FlaskConical, isArray: true },
  covariates: { label: "Covariates", icon: ListChecks, isArray: true },
  constraints: { label: "Study Constraints", icon: AlertCircle, isArray: false },
};

function formatPICOStatement(scopeValues: TopicScopeValues): string {
  const parts: string[] = [];
  
  if (scopeValues.population) {
    parts.push(`In ${scopeValues.population.toLowerCase()}`);
  }
  if (scopeValues.intervention) {
    parts.push(`evaluating ${scopeValues.intervention.toLowerCase()}`);
  }
  if (scopeValues.comparator) {
    parts.push(`compared to ${scopeValues.comparator.toLowerCase()}`);
  }
  if (scopeValues.outcomes) {
    parts.push(`measuring ${scopeValues.outcomes.toLowerCase()}`);
  }
  if (scopeValues.timeframe) {
    parts.push(`over ${scopeValues.timeframe.toLowerCase()}`);
  }
  
  return parts.length > 0 ? parts.join(", ") + "." : "No topic defined yet.";
}

function VersionBadge({ version, isLatest }: { version: TopicVersion; isLatest: boolean }) {
  const changeTypeColors = {
    initial: "bg-ros-primary/10 text-ros-primary border-ros-primary/30",
    refinement: "bg-ros-success/10 text-ros-success border-ros-success/30",
    major_revision: "bg-ros-alert/10 text-ros-alert border-ros-alert/30",
    ai_suggestion: "bg-ros-workflow/10 text-ros-workflow border-ros-workflow/30",
  };

  return (
    <Badge
      variant="outline"
      className={`text-xs gap-1 ${changeTypeColors[version.changeType]}`}
      data-testid={`badge-version-${version.version}`}
    >
      v{version.version}
      {isLatest && <span className="text-[10px]">latest</span>}
    </Badge>
  );
}

export function ResearchBriefPanel({
  versionHistory,
  onVersionSelect: _onVersionSelect,
  onLock,
  onExtendedFieldsUpdate,
  isLocked = false,
}: ResearchBriefPanelProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditingExtended, setIsEditingExtended] = useState(false);
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<{
    v1: TopicVersion | null;
    v2: TopicVersion | null;
  }>({ v1: null, v2: null });
  const [extendedFormValues, setExtendedFormValues] = useState<{
    datasetSource: string;
    cohortInclusion: string;
    cohortExclusion: string;
    exposures: string;
    covariates: string;
    constraints: string;
  }>({
    datasetSource: "",
    cohortInclusion: "",
    cohortExclusion: "",
    exposures: "",
    covariates: "",
    constraints: "",
  });

  const currentVersion = versionHistory.versions.find(
    (v) => v.version === versionHistory.currentVersion
  );

  const initializeFormValues = () => {
    const fields = currentVersion?.extendedFields;
    setExtendedFormValues({
      datasetSource: fields?.datasetSource || "",
      cohortInclusion: fields?.cohortInclusion?.join(", ") || "",
      cohortExclusion: fields?.cohortExclusion?.join(", ") || "",
      exposures: fields?.exposures?.join(", ") || "",
      covariates: fields?.covariates?.join(", ") || "",
      constraints: fields?.constraints || "",
    });
  };

  const handleEditExtended = () => {
    initializeFormValues();
    setIsEditingExtended(true);
  };

  const handleCancelEdit = () => {
    setIsEditingExtended(false);
  };

  const parseCommaSeparated = (value: string): string[] => {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  };

  const handleSaveExtended = () => {
    const updatedFields: ExtendedTopicFields = {
      datasetSource: extendedFormValues.datasetSource || undefined,
      cohortInclusion: parseCommaSeparated(extendedFormValues.cohortInclusion),
      cohortExclusion: parseCommaSeparated(extendedFormValues.cohortExclusion),
      exposures: parseCommaSeparated(extendedFormValues.exposures),
      covariates: parseCommaSeparated(extendedFormValues.covariates),
      constraints: extendedFormValues.constraints || undefined,
    };
    onExtendedFieldsUpdate?.(updatedFields);
    setIsEditingExtended(false);
  };

  const handleCopy = async () => {
    if (currentVersion) {
      const statement = formatPICOStatement(currentVersion.scopeValues);
      await navigator.clipboard.writeText(statement);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleVersionSelectForDiff = (version: TopicVersion) => {
    setSelectedVersions((prev) => {
      if (prev.v1 && prev.v1.version === version.version) {
        return { v1: null, v2: prev.v2 };
      }
      if (prev.v2 && prev.v2.version === version.version) {
        return { v1: prev.v1, v2: null };
      }
      if (!prev.v1) {
        return { v1: version, v2: prev.v2 };
      }
      if (!prev.v2) {
        return { v1: prev.v1, v2: version };
      }
      return { v1: prev.v2, v2: version };
    });
  };

  const isVersionSelected = (version: TopicVersion) => {
    return (
      (selectedVersions.v1 && selectedVersions.v1.version === version.version) ||
      (selectedVersions.v2 && selectedVersions.v2.version === version.version)
    );
  };

  const canCompare = selectedVersions.v1 && selectedVersions.v2;

  const handleOpenDiffModal = () => {
    if (canCompare) {
      const v1 = selectedVersions.v1!.version < selectedVersions.v2!.version 
        ? selectedVersions.v1 
        : selectedVersions.v2;
      const v2 = selectedVersions.v1!.version < selectedVersions.v2!.version 
        ? selectedVersions.v2 
        : selectedVersions.v1;
      setSelectedVersions({ v1, v2 });
      setDiffModalOpen(true);
    }
  };

  const clearVersionSelection = () => {
    setSelectedVersions({ v1: null, v2: null });
  };

  if (!currentVersion) {
    return (
      <Card className="p-4 bg-muted/50" data-testid="panel-research-brief-empty">
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span className="text-sm">No research brief defined yet</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden" data-testid="panel-research-brief">
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-ros-primary" />
            <span className="font-medium text-sm">Research Brief</span>
            <VersionBadge version={currentVersion} isLatest={currentVersion.version === versionHistory.currentVersion} />
            {isLocked && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Lock className="h-3 w-3" />
                Locked
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopy}
              className="h-7 w-7"
              data-testid="button-copy-brief"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-ros-success" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
            {versionHistory.versions.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowHistory(!showHistory)}
                className="h-7 w-7"
                data-testid="button-toggle-history"
              >
                <History className="h-3.5 w-3.5" />
              </Button>
            )}
            {onLock && !isLocked && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onLock}
                className="h-7 w-7"
                title="Lock topic (prevents further changes)"
                data-testid="button-lock-topic"
              >
                <Lock className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="p-4">
        <p className="text-sm text-foreground leading-relaxed mb-4" data-testid="text-pico-statement">
          {formatPICOStatement(currentVersion.scopeValues)}
        </p>

        <div className="grid gap-2">
          {Object.entries(currentVersion.scopeValues).map(([key, value]) => {
            if (!value) return null;
            const config = PICO_LABELS[key as keyof TopicScopeValues];
            const IconComponent = config.icon;
            return (
              <div
                key={key}
                className="flex items-start gap-2 text-sm"
                data-testid={`pico-${key}`}
              >
                <IconComponent className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium text-muted-foreground">{config.label}: </span>
                  <span className="text-foreground">{value}</span>
                </div>
              </div>
            );
          })}
        </div>

        {currentVersion.extendedFields && Object.keys(currentVersion.extendedFields).some(
          key => {
            const val = currentVersion.extendedFields?.[key as keyof ExtendedTopicFields];
            return val !== undefined && (Array.isArray(val) ? val.length > 0 : val !== "");
          }
        ) && !isEditingExtended && (
          <div className="mt-4 pt-3 border-t border-border">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <ListChecks className="h-3 w-3" />
                Extended Study Parameters
              </div>
              {onExtendedFieldsUpdate && !isLocked && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEditExtended}
                  className="h-6 text-xs gap-1"
                  data-testid="button-edit-extended-fields"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </Button>
              )}
            </div>
            <div className="grid gap-2">
              {Object.entries(currentVersion.extendedFields).map(([key, value]) => {
                if (!value || (Array.isArray(value) && value.length === 0)) return null;
                const config = EXTENDED_FIELD_LABELS[key as keyof ExtendedTopicFields];
                if (!config) return null;
                const IconComponent = config.icon;
                return (
                  <div
                    key={key}
                    className="flex items-start gap-2 text-sm"
                    data-testid={`extended-${key}`}
                  >
                    <IconComponent className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <span className="font-medium text-muted-foreground">{config.label}: </span>
                      {config.isArray && Array.isArray(value) ? (
                        <span className="text-foreground">
                          {value.map((item, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="mr-1 mb-1 text-xs"
                            >
                              {item}
                            </Badge>
                          ))}
                        </span>
                      ) : (
                        <span className="text-foreground">{value}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!isEditingExtended && onExtendedFieldsUpdate && !isLocked && !currentVersion.extendedFields && (
          <div className="mt-4 pt-3 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEditExtended}
              className="w-full text-xs gap-2"
              data-testid="button-add-extended-fields"
            >
              <Pencil className="h-3 w-3" />
              Add Extended Fields
            </Button>
          </div>
        )}

        {isEditingExtended && (
          <div className="mt-4 pt-3 border-t border-border" data-testid="form-extended-fields">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Pencil className="h-3 w-3" />
                Edit Extended Study Parameters
              </div>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="datasetSource" className="text-xs flex items-center gap-1.5">
                  <Database className="h-3 w-3" />
                  Dataset Source
                </Label>
                <Input
                  id="datasetSource"
                  value={extendedFormValues.datasetSource}
                  onChange={(e) => setExtendedFormValues(prev => ({ ...prev, datasetSource: e.target.value }))}
                  placeholder="e.g., MIMIC-IV, UK Biobank, Custom Registry"
                  className="text-sm"
                  data-testid="input-datasetSource"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cohortInclusion" className="text-xs flex items-center gap-1.5">
                  <UserCheck className="h-3 w-3" />
                  Inclusion Criteria (comma-separated)
                </Label>
                <Input
                  id="cohortInclusion"
                  value={extendedFormValues.cohortInclusion}
                  onChange={(e) => setExtendedFormValues(prev => ({ ...prev, cohortInclusion: e.target.value }))}
                  placeholder="e.g., Age >= 18, Confirmed diagnosis, Complete follow-up"
                  className="text-sm"
                  data-testid="input-cohortInclusion"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cohortExclusion" className="text-xs flex items-center gap-1.5">
                  <UserX className="h-3 w-3" />
                  Exclusion Criteria (comma-separated)
                </Label>
                <Input
                  id="cohortExclusion"
                  value={extendedFormValues.cohortExclusion}
                  onChange={(e) => setExtendedFormValues(prev => ({ ...prev, cohortExclusion: e.target.value }))}
                  placeholder="e.g., Pregnancy, Active malignancy, Missing key variables"
                  className="text-sm"
                  data-testid="input-cohortExclusion"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="exposures" className="text-xs flex items-center gap-1.5">
                  <FlaskConical className="h-3 w-3" />
                  Exposure Variables (comma-separated)
                </Label>
                <Input
                  id="exposures"
                  value={extendedFormValues.exposures}
                  onChange={(e) => setExtendedFormValues(prev => ({ ...prev, exposures: e.target.value }))}
                  placeholder="e.g., Drug dosage, Treatment duration, Intervention type"
                  className="text-sm"
                  data-testid="input-exposures"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="covariates" className="text-xs flex items-center gap-1.5">
                  <ListChecks className="h-3 w-3" />
                  Covariates (comma-separated)
                </Label>
                <Input
                  id="covariates"
                  value={extendedFormValues.covariates}
                  onChange={(e) => setExtendedFormValues(prev => ({ ...prev, covariates: e.target.value }))}
                  placeholder="e.g., Age, BMI, Comorbidities, Baseline labs"
                  className="text-sm"
                  data-testid="input-covariates"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="constraints" className="text-xs flex items-center gap-1.5">
                  <AlertCircle className="h-3 w-3" />
                  Study Constraints
                </Label>
                <Textarea
                  id="constraints"
                  value={extendedFormValues.constraints}
                  onChange={(e) => setExtendedFormValues(prev => ({ ...prev, constraints: e.target.value }))}
                  placeholder="e.g., Minimum sample size requirements, data availability limitations, regulatory constraints..."
                  className="text-sm min-h-[60px]"
                  data-testid="input-constraints"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSaveExtended}
                  className="gap-1.5"
                  data-testid="button-save-extended-fields"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="gap-1.5"
                  data-testid="button-cancel-extended-fields"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {currentVersion.sha256Hash && (
          <div className="mt-4 pt-3 border-t border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3 w-3" />
              <span className="font-mono">
                SHA-256: {currentVersion.sha256Hash.slice(0, 16)}...
              </span>
            </div>
          </div>
        )}
      </div>

      <Collapsible open={showHistory} onOpenChange={setShowHistory}>
        <CollapsibleContent>
          <div className="border-t border-border">
            <div className="p-3 bg-muted/30">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <History className="h-3 w-3" />
                  Version History ({versionHistory.versions.length})
                </div>
                <div className="flex items-center gap-1">
                  {(selectedVersions.v1 || selectedVersions.v2) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearVersionSelection}
                      className="h-6 text-xs gap-1"
                      data-testid="button-clear-selection"
                    >
                      <X className="h-3 w-3" />
                      Clear
                    </Button>
                  )}
                  {canCompare && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleOpenDiffModal}
                      className="h-6 text-xs gap-1"
                      data-testid="button-compare-versions"
                    >
                      <GitCompare className="h-3 w-3" />
                      Compare v{selectedVersions.v1?.version} → v{selectedVersions.v2?.version}
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mb-2">
                Click to select versions for comparison
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                <AnimatePresence>
                  {versionHistory.versions
                    .slice()
                    .reverse()
                    .map((version) => {
                      const selected = isVersionSelected(version);
                      return (
                        <motion.div
                          key={version.version}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className={`p-2 rounded-md border text-xs cursor-pointer hover-elevate ${
                            selected
                              ? "border-ros-workflow/50 bg-ros-workflow/10 ring-1 ring-ros-workflow/30"
                              : version.version === versionHistory.currentVersion
                                ? "border-ros-primary/30 bg-ros-primary/5"
                                : "border-border bg-background"
                          }`}
                          onClick={() => handleVersionSelectForDiff(version)}
                          data-testid={`history-version-${version.version}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {selected && (
                                <div className="h-4 w-4 rounded-full bg-ros-workflow flex items-center justify-center">
                                  <Check className="h-2.5 w-2.5 text-white" />
                                </div>
                              )}
                              <VersionBadge
                                version={version}
                                isLatest={version.version === versionHistory.currentVersion}
                              />
                            </div>
                            <span className="text-muted-foreground">
                              {new Date(version.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          {version.changeDescription && (
                            <p className="mt-1 text-muted-foreground line-clamp-1">
                              {version.changeDescription}
                            </p>
                          )}
                        </motion.div>
                      );
                    })}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <TopicVersionDiff
        open={diffModalOpen}
        onOpenChange={setDiffModalOpen}
        v1={selectedVersions.v1}
        v2={selectedVersions.v2}
      />
    </Card>
  );
}

export function TopicVersionBadge({
  version,
  onClick,
  size = "default",
}: {
  version: number;
  onClick?: () => void;
  size?: "sm" | "default";
}) {
  return (
    <Badge
      variant="outline"
      className={`gap-1 cursor-pointer hover-elevate bg-ros-primary/10 text-ros-primary border-ros-primary/30 ${
        size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs"
      }`}
      onClick={onClick}
      data-testid="badge-topic-version"
    >
      <GitBranch className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      v{version}
    </Badge>
  );
}

export function createVersionHash(scopeValues: TopicScopeValues): string {
  const str = JSON.stringify(scopeValues);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0').slice(0, 16);
}
