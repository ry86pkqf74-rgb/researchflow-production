/**
 * Clinical Data Extraction Components
 * 
 * This module provides React components for the clinical data extraction UI:
 * - ExtractionProgressPanel: Real-time extraction progress with PHI alerts
 * - ExtractionResultsViewer: Display extracted data with evidence highlighting
 * - ExtractionConfigPanel: Configuration for extraction parameters
 * - ExtractionMetricsCard: Accuracy and performance metrics
 */

export {
  ExtractionProgressPanel,
  type ExtractionJob,
  type ExtractionProgress,
  type ExtractionProgressPanelProps,
} from './ExtractionProgressPanel';

export {
  ExtractionResultsViewer,
  type Evidence,
  type ExtractedItem,
  type MedicationItem,
  type StudyFields,
  type ClinicalExtraction,
  type ExtractionResultsViewerProps,
} from './ExtractionResultsViewer';

export {
  ExtractionConfigPanel,
  type ExtractionTier,
  type ColumnInfo,
  type ExtractionConfig,
  type CostEstimate,
  type ExtractionConfigPanelProps,
} from './ExtractionConfigPanel';

export {
  ExtractionMetricsCard,
  type CategoryMetrics,
  type PerformanceMetrics,
  type CostMetrics,
  type ExtractionMetrics,
  type ExtractionMetricsCardProps,
} from './ExtractionMetricsCard';
