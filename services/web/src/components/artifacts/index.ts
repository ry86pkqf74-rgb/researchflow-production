/**
 * Artifacts Components
 * Phase 4D - Artifact Browser 2.0 Implementation
 */

// Existing components
export { SimilarArtifacts } from './SimilarArtifacts';
export {
  ArtifactPreview,
  ArtifactComparison,
  ArtifactList,
  ArtifactBrowser,
  ArtifactPreviewSkeleton,
  detectArtifactType,
  type Artifact,
  type ArtifactType,
} from './ArtifactPreview';

// Phase 4D New Components
// ART-001: Tree View
export { ArtifactTree, type TreeNode } from './ArtifactTree';

// ART-002: PDF Preview
export { PDFPreview } from './PDFPreview';

// ART-003: Image Preview
export { ImagePreview } from './ImagePreview';

// ART-004: Text/JSON Syntax Highlight
export { TextPreview } from './TextPreview';

// ART-005: CSV Table Preview
export { CSVPreview } from './CSVPreview';

// ART-006: Provenance Graph
export {
  ProvenanceGraph,
  type ProvenanceNode,
  type ProvenanceEdge,
} from './ProvenanceGraph';

// ART-007: Download Bundle
export { DownloadBundle, type BundleArtifact } from './DownloadBundle';

// ART-008: Artifact Diff
export { ArtifactDiff, type DiffArtifact } from './ArtifactDiff';
