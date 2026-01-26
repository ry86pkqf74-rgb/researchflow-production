/**
 * Dataset Status Card Component
 *
 * Visual indicator for data classification and permitted operations.
 * Provides at-a-glance understanding of what can be done with the data.
 *
 * Priority: P0 - CRITICAL (Phase 2)
 */

import { safeFixed } from "@/lib/format";
import {
  Shield,
  Lock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Database,
  Calendar,
  FileText
} from 'lucide-react';
import {
  DataClassification,
  DatasetMetadata,
  CLASSIFICATION_RULES,
  getClassificationStyle
} from "@packages/core/types/classification"

interface DatasetStatusCardProps {
  dataset: DatasetMetadata;
  showDetails?: boolean;
}

/**
 * Badge component for classification level
 */
function ClassificationBadge({ classification }: { classification: DataClassification }) {
  const style = getClassificationStyle(classification);

  const icons = {
    SYNTHETIC: CheckCircle,
    DEIDENTIFIED: Shield,
    IDENTIFIED: Lock,
    UNKNOWN: AlertTriangle
  };

  const Icon = icons[classification];

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${style.color} border-2 ${style.borderColor}`}>
      <Icon className={`h-4 w-4 ${style.textColor}`} />
      <span className={`text-sm font-semibold ${style.textColor}`}>
        {classification}
      </span>
    </div>
  );
}

/**
 * Permitted operations list
 */
function PermittedOperations({ classification }: { classification: DataClassification }) {
  const rules = CLASSIFICATION_RULES[classification];
  const operations = rules.allowedOperations;

  return (
    <div className="mt-3">
      <h4 className="text-xs font-semibold text-gray-600 mb-2">PERMITTED OPERATIONS</h4>
      <div className="space-y-1">
        {operations.map(op => (
          <div key={op} className="flex items-center gap-2 text-sm">
            {op !== 'BLOCK_ALL' && op !== 'VIEW_METADATA_ONLY' ? (
              <CheckCircle className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
            )}
            <span className={op === 'BLOCK_ALL' || op === 'VIEW_METADATA_ONLY' ? 'text-red-600' : 'text-gray-700'}>
              {op.replace(/_/g, ' ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Dataset metadata details
 */
function DatasetDetails({ dataset }: { dataset: DatasetMetadata }) {
  return (
    <div className="mt-4 space-y-2 text-sm">
      <div className="flex items-center gap-2 text-gray-600">
        <Database className="h-4 w-4 flex-shrink-0" />
        <span className="font-medium">{dataset.recordCount.toLocaleString()}</span> records
      </div>

      <div className="flex items-center gap-2 text-gray-600">
        <Calendar className="h-4 w-4 flex-shrink-0" />
        <span>Uploaded {new Date(dataset.uploadedAt).toLocaleDateString()}</span>
      </div>

      <div className="flex items-center gap-2 text-gray-600">
        <FileText className="h-4 w-4 flex-shrink-0" />
        <span>{dataset.format} • {safeFixed((dataset.sizeBytes / 1024 / 1024), 2)} MB</span>
      </div>

      {dataset.irbNumber && (
        <div className="flex items-center gap-2 text-gray-600">
          <Shield className="h-4 w-4 flex-shrink-0" />
          <span>IRB: {dataset.irbNumber}</span>
        </div>
      )}

      {dataset.deidentificationMethod && dataset.deidentificationMethod !== 'NONE' && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <div className="text-xs text-gray-500">De-identification Method:</div>
          <div className="text-sm font-medium text-gray-700">
            {dataset.deidentificationMethod.replace(/_/g, ' ')}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * PHI Scan Status
 */
function PHIScanStatus({ dataset }: { dataset: DatasetMetadata }) {
  const passed = dataset.phiScanPassed;

  return (
    <div className={`mt-3 p-2 rounded border-2 ${passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
      <div className="flex items-center gap-2">
        {passed ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <XCircle className="h-4 w-4 text-red-600" />
        )}
        <div className="flex-1">
          <div className={`text-xs font-semibold ${passed ? 'text-green-700' : 'text-red-700'}`}>
            PHI Scan: {passed ? 'PASSED' : 'FAILED'}
          </div>
          {dataset.phiScanAt && (
            <div className="text-xs text-gray-600">
              {new Date(dataset.phiScanAt).toLocaleString()}
            </div>
          )}
        </div>
      </div>
      {!passed && (
        <div className="mt-2 text-xs text-red-700">
          ⚠️ PHI detected - data quarantined. See incident response runbook.
        </div>
      )}
    </div>
  );
}

/**
 * Risk Score Indicator
 */
function RiskScoreIndicator({ score }: { score?: number }) {
  if (score === undefined) return null;

  const getRiskLevel = (score: number) => {
    if (score < 30) return { label: 'LOW', color: 'text-green-600', bg: 'bg-green-100' };
    if (score < 70) return { label: 'MODERATE', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { label: 'HIGH', color: 'text-red-600', bg: 'bg-red-100' };
  };

  const risk = getRiskLevel(score);

  return (
    <div className="mt-3">
      <div className="text-xs font-semibold text-gray-600 mb-1">RISK ASSESSMENT</div>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${risk.bg}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className={`text-xs font-semibold ${risk.color}`}>
          {risk.label}
        </span>
      </div>
      <div className="text-xs text-gray-500 mt-1">
        Score: {score}/100
      </div>
    </div>
  );
}

/**
 * Main Dataset Status Card Component
 */
export function DatasetStatusCard({ dataset, showDetails = true }: DatasetStatusCardProps) {
  const style = getClassificationStyle(dataset.classification);
  const rules = CLASSIFICATION_RULES[dataset.classification];

  return (
    <div className={`border-2 rounded-lg ${style.borderColor} ${style.color} overflow-hidden`}>
      {/* Header */}
      <div className="p-4 bg-white border-b">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 text-lg">{dataset.name}</h3>
            <p className="text-sm text-gray-600 mt-1">{dataset.source}</p>
          </div>
          <ClassificationBadge classification={dataset.classification} />
        </div>

        <p className="text-xs text-gray-600 mt-2">
          {rules.description}
        </p>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* PHI Scan Status */}
        <PHIScanStatus dataset={dataset} />

        {/* Permitted Operations */}
        <PermittedOperations classification={dataset.classification} />

        {/* Risk Score */}
        {dataset.riskScore !== undefined && (
          <RiskScoreIndicator score={dataset.riskScore} />
        )}

        {/* Dataset Details */}
        {showDetails && <DatasetDetails dataset={dataset} />}

        {/* Approval Info */}
        {dataset.approvedBy && (
          <div className="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-600">
            <div>Approved by: <span className="font-medium">{dataset.approvedBy}</span></div>
            {dataset.approvedAt && (
              <div>on {new Date(dataset.approvedAt).toLocaleString()}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact version for sidebar
 */
export function DatasetStatusCardCompact({ dataset }: { dataset: DatasetMetadata }) {
  const style = getClassificationStyle(dataset.classification);

  return (
    <div className={`border-2 rounded p-3 ${style.borderColor} ${style.color}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm text-gray-900 truncate flex-1">
          {dataset.name}
        </span>
        <ClassificationBadge classification={dataset.classification} />
      </div>
      <div className="text-xs text-gray-600">
        {dataset.recordCount.toLocaleString()} records • {dataset.format}
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {CLASSIFICATION_RULES[dataset.classification].allowedOperations.slice(0, 2).join(', ')}
      </div>
    </div>
  );
}

export default DatasetStatusCard;
