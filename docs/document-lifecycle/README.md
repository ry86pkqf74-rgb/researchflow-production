# Document & Artifact Lifecycle

This module implements comprehensive document lifecycle management for ResearchFlow, including artifact versioning, collaboration features, and conference submission workflows.

## Overview

The Document & Artifact Lifecycle system provides:

- **Artifact Graph** - Provenance tracking with dependency detection
- **Comments** - PHI-safe inline and threaded discussions
- **Versioning** - Full version history with word-level diffs
- **Branching** - Git-like branching for parallel work
- **Claims & Evidence** - Claim verification with evidence linking
- **Share Links** - Secure external reviewer access
- **Submissions** - Conference/journal submission tracking
- **Conference Prep** - Provenance tracking with PHI scanning

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Web UI Layer                          │
├─────────────────────────────────────────────────────────────┤
│  ArtifactGraphViewer │ CommentPanel │ VersionDiffViewer     │
│  BranchManager       │ ClaimsViewer │ ShareLinkManager      │
│  SubmissionTracker   │                                       │
├─────────────────────────────────────────────────────────────┤
│                     API Routes Layer                         │
├─────────────────────────────────────────────────────────────┤
│  /artifacts/graph    │ /comments     │ /versions            │
│  /branches           │ /claims       │ /shares              │
│  /submissions        │ /rebuttals    │                      │
├─────────────────────────────────────────────────────────────┤
│                    Services Layer                            │
├─────────────────────────────────────────────────────────────┤
│  artifactGraphService │ commentsService │ versioningService │
│  claimsService        │ shareService    │ submissionService │
├─────────────────────────────────────────────────────────────┤
│                    Database Layer                            │
├─────────────────────────────────────────────────────────────┤
│  artifacts │ artifact_edges │ comments │ artifact_versions  │
│  branches  │ claims         │ shares   │ submissions        │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Artifact Graph Service

Tracks provenance relationships between artifacts.

**Key Features:**
- Directed acyclic graph (DAG) of artifact relationships
- Auto-linking from content analysis (figure/table references)
- Outdated artifact detection based on source updates
- Depth-limited traversal for visualization

**Relation Types:**
- `derived_from` - Target was derived from source
- `references` - Target references source
- `supersedes` - Target replaces source
- `uses` - Target uses data from source
- `generated_from` - Target was generated from source analysis
- `exported_to` - Source was exported to target
- `annotates` - Source annotates target

### 2. Comments Service

PHI-safe inline comments with threading support.

**Key Features:**
- Text, table, figure, and slide anchors
- Single-level threading (parent → replies)
- Resolution tracking
- PHI scanning with steward override

**Anchor Types:**
```typescript
interface AnchorData {
  // Text anchor
  selectionText?: string;
  startOffset?: number;
  endOffset?: number;
  sectionId?: string;

  // Table anchor
  tableId?: string;
  rowIndex?: number;
  columnIndex?: number;

  // Figure anchor
  figureId?: string;
  region?: { x: number; y: number; width: number; height: number };

  // Slide anchor
  slideNumber?: number;
  elementId?: string;
}
```

### 3. Versioning Service

Full version control with word-level diffs.

**Key Features:**
- Automatic version snapshots
- Word-level diff computation
- Version restore capability
- Change description tracking

### 4. Branching Service

Git-like branching for parallel work.

**Key Features:**
- Create branches from any version
- Squash or rebase merge strategies
- Conflict detection
- Archive/delete branches

**Branch Statuses:**
- `active` - Currently in use
- `merged` - Merged back to main
- `archived` - Kept for reference

### 5. Claims Service

Claim verification with evidence linking.

**Key Features:**
- PHI-safe claim text storage
- Evidence linking (figures, tables, datasets, citations, URLs)
- Claim status tracking (draft, verified, disputed, retracted)
- Hash-based claim deduplication

### 6. Share Service

Secure external reviewer access.

**Key Features:**
- Cryptographically secure tokens (256-bit)
- Permission levels (read, comment)
- Configurable expiration (1-365 days)
- Revoke and extend capabilities
- Access logging for audit

**Security:**
- Tokens are hashed before storage (SHA-256)
- Raw token returned only once on creation
- Access count and last-accessed tracking

### 7. Submission Service

Conference/journal submission tracking.

**Key Features:**
- Submission lifecycle management
- Reviewer point tracking with categories
- Rebuttal response drafting
- Package generation with PHI verification

**Submission Statuses:**
- `draft` - Not yet submitted
- `submitted` - Sent to venue
- `under_review` - Being reviewed
- `revision_requested` - Changes needed
- `accepted` - Paper accepted
- `rejected` - Paper rejected
- `withdrawn` - Author withdrew

**Reviewer Point Categories:**
- `major` - Significant issues
- `minor` - Small improvements
- `comment` - General feedback
- `praise` - Positive notes

### 8. Conference Prep Provenance (Python Worker)

PHI-safe provenance tracking for conference materials.

**Key Features:**
- Hash-chain integrity for audit compliance
- PHI scanning with pattern matching
- Export manifest generation
- Provenance edge tracking

## API Reference

### Artifact Graph

```
GET  /api/ros/artifacts/:id/graph?depth=3&direction=both
POST /api/ros/artifacts/:id/edges
```

### Comments

```
GET    /api/ros/artifacts/:id/comments
POST   /api/ros/artifacts/:id/comments
POST   /api/ros/comments/:id/resolve
DELETE /api/ros/comments/:id
```

### Versions

```
GET  /api/ros/artifacts/:id/versions
GET  /api/ros/versions/diff?left=:id&right=:id
POST /api/ros/versions/:id/restore
```

### Branches

```
GET    /api/ros/artifacts/:id/branches
POST   /api/ros/artifacts/:id/branches
POST   /api/ros/branches/:id/merge
POST   /api/ros/branches/:id/archive
DELETE /api/ros/branches/:id
```

### Claims

```
GET   /api/ros/claims?researchId=:id
POST  /api/ros/claims
PATCH /api/ros/claims/:id
GET   /api/ros/claims/:id/evidence
POST  /api/ros/claims/:id/evidence
```

### Shares

```
GET  /api/ros/shares?artifactId=:id
POST /api/ros/shares
GET  /api/ros/shares/validate?token=:token
POST /api/ros/shares/:id/revoke
POST /api/ros/shares/:id/extend
```

### Submissions

```
GET   /api/ros/submissions?researchId=:id
POST  /api/ros/submissions
PATCH /api/ros/submissions/:id
GET   /api/ros/submissions/:id/points
POST  /api/ros/submissions/:id/points
POST  /api/ros/points/:id/rebuttal
POST  /api/ros/submissions/:id/packages
```

## Database Schema

### artifact_edges

| Column | Type | Description |
|--------|------|-------------|
| id | varchar | Primary key |
| source_artifact_id | varchar | Source artifact FK |
| target_artifact_id | varchar | Target artifact FK |
| relation_type | varchar | Relationship type |
| transformation_type | varchar | Optional transformation |
| metadata | jsonb | Additional data |

### comments

| Column | Type | Description |
|--------|------|-------------|
| id | varchar | Primary key |
| artifact_id | varchar | Artifact FK |
| parent_comment_id | varchar | Parent comment (nullable) |
| content | text | Comment text |
| anchor_type | varchar | text/table/figure/slide |
| anchor_data | jsonb | Anchor coordinates |
| phi_scan_status | varchar | PENDING/PASS/FAIL/OVERRIDE |
| resolved | boolean | Resolution status |

### shares

| Column | Type | Description |
|--------|------|-------------|
| id | varchar | Primary key |
| artifact_id | varchar | Artifact FK |
| token_hash | varchar | SHA-256 of token |
| permission | varchar | read/comment |
| expires_at | timestamp | Expiration date |
| revoked | boolean | Revocation status |

## PHI Handling

All text content is scanned for PHI patterns before storage:

**High-Confidence Patterns:**
- Social Security Numbers (SSN)
- Medical Record Numbers (MRN)
- Dates of Birth (DOB)
- Patient Names (when identified)
- Phone Numbers
- Email Addresses
- Addresses

**PHI Scan Statuses:**
- `PENDING` - Not yet scanned
- `PASS` - No PHI detected
- `FAIL` - PHI detected, blocked
- `OVERRIDE` - PHI detected, steward approved

**Findings Storage:**
PHI findings store location only (start/end offsets) and a hash sample, never the raw PHI value.

## Testing

```bash
# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run Python tests
cd services/worker && pytest tests/unit/conference_prep/
```

## Security Considerations

1. **Share Tokens**: Use cryptographically secure random bytes, hash before storage
2. **PHI Scanning**: All user content scanned, blocked by default
3. **RBAC**: All endpoints protected with role-based access control
4. **Audit Logging**: All operations logged with user, timestamp, resource
5. **Hash Chains**: Provenance records include hash-chain for tamper detection

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.
