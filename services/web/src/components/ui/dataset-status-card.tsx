import * as React from "react"
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Database,
  Calendar,
  FlaskConical,
  UserCheck,
  HelpCircle,
  Lock,
} from "lucide-react"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type DataClassification = "SYNTHETIC" | "IDENTIFIED" | "DEIDENTIFIED" | "UNKNOWN"
export type PhiStatus = "De-identified" | "PHI Detected" | "Not Scanned" | "Pending"

interface Dataset {
  id: string
  name: string
  type: string
  records: number
  variables: number
  dateRange: string
  phiStatus: PhiStatus
  classification?: DataClassification
}

interface DatasetStatusCardProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "compact" | "detailed"
  dataset?: Dataset | null
  showOperations?: boolean
}

const CLASSIFICATION_CONFIG: Record<DataClassification, {
  color: string
  bgColor: string
  borderColor: string
  icon: React.ElementType
  label: string
  description: string
}> = {
  SYNTHETIC: {
    color: "text-green-700 dark:text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    icon: FlaskConical,
    label: "Synthetic",
    description: "Computer-generated data with no real patient information",
  },
  DEIDENTIFIED: {
    color: "text-blue-700 dark:text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    icon: ShieldCheck,
    label: "De-identified",
    description: "Real patient data with identifiers removed per HIPAA Safe Harbor",
  },
  IDENTIFIED: {
    color: "text-red-700 dark:text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    icon: ShieldAlert,
    label: "Identified",
    description: "Contains protected health information (PHI)",
  },
  UNKNOWN: {
    color: "text-gray-700 dark:text-gray-400",
    bgColor: "bg-gray-500/10",
    borderColor: "border-gray-500/30",
    icon: HelpCircle,
    label: "Unknown",
    description: "Classification pending or not determined",
  },
}

const PERMITTED_OPERATIONS: Record<DataClassification, string[]> = {
  SYNTHETIC: [
    "AI analysis",
    "Export without approval",
    "Share externally",
    "Use in demos",
    "Training purposes",
  ],
  DEIDENTIFIED: [
    "AI analysis",
    "Export with steward approval",
    "Statistical analysis",
    "Manuscript drafting",
  ],
  IDENTIFIED: [
    "View only (restricted)",
    "Export requires IRB + Admin",
    "No AI processing",
    "Audit required",
  ],
  UNKNOWN: [
    "View only",
    "Classification required before processing",
    "No export allowed",
  ],
}

function deriveClassification(phiStatus: PhiStatus): DataClassification {
  switch (phiStatus) {
    case "De-identified":
      return "DEIDENTIFIED"
    case "PHI Detected":
      return "IDENTIFIED"
    case "Not Scanned":
    case "Pending":
    default:
      return "UNKNOWN"
  }
}

const DatasetStatusCard = React.forwardRef<
  HTMLDivElement,
  DatasetStatusCardProps
>(({ variant = "detailed", dataset, showOperations = false, className, ...props }, ref) => {
  if (!dataset) {
    return null
  }

  const classification = dataset.classification || deriveClassification(dataset.phiStatus)
  const classificationConfig = CLASSIFICATION_CONFIG[classification]
  const ClassificationIcon = classificationConfig.icon
  const permittedOps = PERMITTED_OPERATIONS[classification]

  const getPhiStatusInfo = (status: PhiStatus) => {
    switch (status) {
      case "De-identified":
        return {
          badgeVariant: "default" as const,
          icon: ShieldCheck,
          testIdSuffix: "de-identified",
        }
      case "PHI Detected":
        return {
          badgeVariant: "destructive" as const,
          icon: ShieldAlert,
          testIdSuffix: "phi-detected",
        }
      case "Not Scanned":
        return {
          badgeVariant: "outline" as const,
          icon: Shield,
          testIdSuffix: "not-scanned",
        }
      case "Pending":
        return {
          badgeVariant: "secondary" as const,
          icon: Shield,
          testIdSuffix: "pending",
        }
      default:
        return {
          badgeVariant: "outline" as const,
          icon: Shield,
          testIdSuffix: "unknown",
        }
    }
  }

  const phiInfo = getPhiStatusInfo(dataset.phiStatus)
  const PhiIcon = phiInfo.icon

  const classificationTestId = (dataset.type || "unknown")
    .toLowerCase()
    .replace(/\s+/g, "-")

  if (variant === "compact") {
    return (
      <Card
        ref={ref}
        className={cn("w-full", className)}
        data-testid="card-dataset-status-compact"
        {...props}
      >
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3
                  className="text-sm font-semibold truncate"
                  data-testid="text-dataset-name"
                >
                  {dataset.name}
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                className={cn(
                  classificationConfig.bgColor,
                  classificationConfig.color,
                  "border",
                  classificationConfig.borderColor
                )}
                variant="outline"
                data-testid={`badge-classification-${classification.toLowerCase()}`}
              >
                <ClassificationIcon className="h-3 w-3 mr-1" />
                {classificationConfig.label}
              </Badge>
              <Badge
                variant={phiInfo.badgeVariant}
                data-testid={`badge-phi-status-${phiInfo.testIdSuffix}`}
              >
                {dataset.phiStatus}
              </Badge>
            </div>
          </div>
        </CardHeader>
        {showOperations && (
          <CardContent className="pt-0 pb-3">
            <div className="border-t pt-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Lock className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Permitted</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-0.5" data-testid="list-permitted-operations-compact">
                {permittedOps.slice(0, 3).map((op, idx) => (
                  <li key={idx} className="flex items-center gap-1.5 truncate">
                    <UserCheck className="h-2.5 w-2.5 flex-shrink-0" />
                    <span className="truncate">{op}</span>
                  </li>
                ))}
                {permittedOps.length > 3 && (
                  <li className="text-xs text-muted-foreground/70">
                    +{permittedOps.length - 3} more...
                  </li>
                )}
              </ul>
            </div>
          </CardContent>
        )}
      </Card>
    )
  }

  return (
    <Card
      ref={ref}
      className={cn("w-full", className)}
      data-testid="card-dataset-status-detailed"
      {...props}
    >
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3
              className="text-lg font-semibold"
              data-testid="text-dataset-name"
            >
              {dataset.name}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {classificationConfig.description}
            </p>
          </div>
          <div className={cn(
            "flex-shrink-0 rounded-lg p-2",
            classificationConfig.bgColor,
            classificationConfig.borderColor,
            "border"
          )}>
            <ClassificationIcon className={cn("h-5 w-5", classificationConfig.color)} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Classification:
          </span>
          <Badge
            className={cn(
              classificationConfig.bgColor,
              classificationConfig.color,
              "border",
              classificationConfig.borderColor
            )}
            variant="outline"
            data-testid={`badge-classification-${classification.toLowerCase()}`}
          >
            <ClassificationIcon className="h-3 w-3 mr-1" />
            {classificationConfig.label}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            PHI Status:
          </span>
          <Badge
            variant={phiInfo.badgeVariant}
            data-testid={`badge-phi-status-${phiInfo.testIdSuffix}`}
          >
            <PhiIcon className="h-3 w-3 mr-1" />
            {dataset.phiStatus}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Type:
          </span>
          <Badge
            variant="secondary"
            data-testid={`badge-type-${classificationTestId}`}
          >
            {dataset.type}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Database className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Records:</span>
          <span className="font-medium" data-testid="text-record-count">
            {dataset.records.toLocaleString()}
          </span>
          <span className="text-muted-foreground mx-1">|</span>
          <span className="text-muted-foreground">Variables:</span>
          <span className="font-medium" data-testid="text-variable-count">
            {dataset.variables.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Date Range:</span>
          <span className="font-medium" data-testid="text-date-range">
            {dataset.dateRange}
          </span>
        </div>

        {showOperations && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Permitted Operations</span>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1" data-testid="list-permitted-operations">
              {permittedOps.map((op, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <UserCheck className="h-3 w-3" />
                  {op}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
})

DatasetStatusCard.displayName = "DatasetStatusCard"

export { DatasetStatusCard }
export type { DatasetStatusCardProps, Dataset }
