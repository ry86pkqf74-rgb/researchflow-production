export {
  StageLayout,
  StageMiniCard,
  StageSidebar,
  StageCompletionSummary,
  type StageStatus,
  type StageState,
} from './StageLayout';

export {
  Stage00ManuscriptIdeation,
} from './Stage00ManuscriptIdeation';

export {
  Stage01Hypothesis,
  type Hypothesis,
} from './Stage01Hypothesis';

export {
  Stage02LiteratureReview,
  type Citation,
  type LiteratureSummary,
  type SearchQuery as LiteratureSearchQuery,
} from './Stage02LiteratureReview';

export {
  Stage03LiteratureSearch,
  type Reference,
  type SearchQuery,
} from './Stage03LiteratureSearch';

export {
  Stage20FinalExport,
  type ExportFormat,
  type ExportOption,
  type PhiScanResult,
  type ApprovalStatus,
  type ExportBundle,
} from './Stage20FinalExport';

export {
  Stage06Analysis,
  type AnalysisJob,
  type AnalysisJobConfig,
  type AnalysisJobStatus,
  type AnalysisType,
  type AnalysisMetric,
  type AnalysisResult,
  type LogEntry,
  type ResourceUsage,
} from './Stage06Analysis';

export {
  Stage07StatisticalModeling,
  type ModelType,
  type VariableType,
  type AssumptionStatus,
  type ModelStatus,
  type Variable,
  type ModelAssumption,
  type CoefficientEstimate,
  type ModelFitStatistics,
  type ResidualPlot,
  type StatisticalModel,
  type DatasetVariable,
} from './Stage07StatisticalModeling';

export {
  Stage08Visualization,
  type ChartType,
  type ExportFormat as VisualizationExportFormat,
  type FigureStatus,
  type DataColumn,
  type AxisMapping,
  type ColorConfig,
  type LegendConfig,
  type ChartStyle,
  type ChartConfig,
  type Figure,
  type AIRecommendation,
  type DatasetInfo,
} from './Stage08Visualization';

export {
  Stage10Validation,
  type ValidationCategory,
  type ValidationItemStatus,
  type IssueSeverity,
  type IssueStatus,
  type SignOffStatus,
  type Reviewer,
  type ValidationItem,
  type ValidationIssue,
  type ValidationChecklist,
  type ValidationReport,
} from './Stage10Validation';

export {
  Stage11Iteration,
  type IterationStatus,
  type RefinementType,
  type FeedbackSeverity,
  type ChangeType,
  type ValidationFeedback,
  type IterationChange,
  type RefinementSuggestion,
  type IterationVersion,
  type IterationLog,
} from './Stage11Iteration';

export {
  Stage12Documentation,
  type ReportTemplateType,
  type SectionStatus,
  type PhiScanStatus,
  type ExportFormat as DocumentExportFormat,
  type Citation as DocumentCitation,
  type DocumentSection,
  type TableOfContentsItem,
  type DocumentPhiScan,
  type ReportTemplate,
  type DocumentMetadata,
  type ExportOptions as DocumentExportOptions,
} from './Stage12Documentation';

export {
  Stage13InternalReview,
  type ReviewerPersonaType,
  type FeedbackSeverity as ReviewFeedbackSeverity,
  type FeedbackCategory,
  type FeedbackStatus,
  type ReviewRoundStatus,
  type RatingLevel,
  type ReviewerPersona,
  type RubricCriterion,
  type ReviewRubric,
  type ReviewFeedbackItem,
  type CriterionScore,
  type ReviewScorecard,
  type ReviewRound,
} from './Stage13InternalReview';

export {
  Stage14EthicalReview,
  type ComplianceFramework,
  type ComplianceItemStatus,
  type RemediationPriority,
  type RemediationStatus,
  type AuditEventType,
  type ConsentStatus,
  type PhiScanStatus as EthicalPhiScanStatus,
  type EvidenceAttachment,
  type ComplianceRequirement,
  type RemediationTask,
  type ConsentRecord,
  type AuditEvent,
  type PhiScanResult as EthicalPhiScanResult,
  type ComplianceReport,
  type EthicalReviewState,
} from './Stage14EthicalReview';

export {
  Stage15ArtifactBundling,
  type ArtifactCategory,
  type BundleFormat,
  type PhiScanStatus as ArtifactPhiScanStatus,
  type ArtifactStatus,
  type Artifact,
  type DublinCoreMetadata,
  type BundleManifest,
  type BundleConfiguration,
  type BundlePreview,
  type PreviewNode,
  type StageComponentProps,
  type ArtifactBundlingState,
} from './Stage15ArtifactBundling';

export {
  Stage17Archiving,
  type ArchiveRepositoryType,
  type PreservationFormat,
  type RetentionPeriod,
  type ArchiveJobStatus,
  type ChecksumAlgorithm,
  type PhiRedactionStatus as ArchivePhiRedactionStatus,
  type MetadataEnrichmentStatus,
  type ArchiveRepository,
  type PreservationConfig,
  type RetentionPolicy,
  type PersistentIdentifier,
  type FileIntegrityRecord,
  type ArchiveJob,
  type ArchiveJobLog,
  type PhiRedactionConfig,
  type PhiFinding,
  type PreservationMetadata,
  type MetadataEnrichment,
  type ArchiveRecord,
  type StageComponentProps as ArchiveStageComponentProps,
} from './Stage17Archiving';

export {
  Stage18ImpactAssessment,
  type MetricTrend,
  type CitationSource,
  type AltmetricSource,
  type ImpactCategory,
  type TimeRange,
  type ExportFormat as ImpactExportFormat,
  type CitationMetric,
  type CitationRecord,
  type AltmetricScore,
  type AltmetricMention,
  type UsageStatistic,
  type TimeSeriesDataPoint,
  type ImpactTimeSeries,
  type FieldComparison,
  type ImpactNarrative,
  type ImpactReport,
  type ImpactAssessmentState,
  type StageComponentProps as ImpactStageComponentProps,
} from './Stage18ImpactAssessment';

export {
  Stage16CollaborationHandoff,
  type CollaboratorRole,
  type InvitationStatus,
  type HandoffPackageStatus,
  type AccessGrantStatus,
  type AgreementStatus,
  type AuditActionType as CollaborationAuditActionType,
  type Collaborator,
  type PermissionMatrix,
  type HandoffArtifact,
  type HandoffPackage,
  type AccessGrant,
  type PhiAgreement,
  type AuditLogEntry as CollaborationAuditLogEntry,
  type CollaboratorSuggestion,
  type OwnershipTransfer,
  type StageComponentProps as CollaborationStageComponentProps,
  type CollaborationHandoffState,
} from './Stage16CollaborationHandoff';

export {
  Stage19Dissemination,
  type PublicationStatus,
  type TargetAudience,
  type PresentationType,
  type MediaMaterialType,
  type SocialPlatform,
  type PhiReviewStatus as DisseminationPhiReviewStatus,
  type DisseminationEventType,
  type JournalSubmission,
  type SlideTemplate,
  type PresentationSlide,
  type PresentationMaterial,
  type MediaMaterial,
  type DisseminationEvent,
  type PhiScanResult as DisseminationPhiScanResult,
  type StageComponentProps as DisseminationStageComponentProps,
  type DisseminationState,
} from './Stage19Dissemination';
