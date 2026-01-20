# Custom Workflow Builder

## Overview

The Custom Workflow Builder allows users to create, edit, and manage custom research workflows using a visual DAG (Directed Acyclic Graph) editor. Workflows are versioned, can have policies applied, and support checkpointing for long-running executions.

## Architecture

### Components

1. **Database Layer** (PostgreSQL + Drizzle ORM)
   - `workflows` - Core workflow metadata
   - `workflow_versions` - Versioned workflow definitions
   - `workflow_templates` - Pre-built workflow templates
   - `workflow_policies` - Governance policies per workflow
   - `workflow_run_checkpoints` - Execution state for resumption

2. **API Layer** (Express.js)
   - `/api/workflows` - CRUD operations for workflows
   - `/api/workflows/:id/versions` - Version management
   - `/api/workflows/templates` - Template listing
   - `/api/workflows/:id/policy` - Policy management

3. **Worker Layer** (Python FastAPI)
   - `DAGCompiler` - Validates and compiles workflow definitions
   - `DAGRunner` - Executes compiled workflows with checkpointing

4. **Frontend Layer** (React + ReactFlow)
   - `WorkflowsPage` - List and manage workflows
   - `WorkflowBuilderPage` - Visual DAG editor

## Data Model

### Workflow Definition Schema

\`\`\`typescript
interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  settings: WorkflowSettings;
}

interface WorkflowNode {
  id: string;
  type: StageType;
  label: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition?: 'on_success' | 'on_failure' | 'always';
}

interface WorkflowSettings {
  timeout_minutes: number;
  retry_policy: 'none' | 'linear' | 'exponential';
  checkpoint_enabled: boolean;
}
\`\`\`

### Stage Types

| Type | Description | Icon |
|------|-------------|------|
| `data_ingestion` | Load data from sources | Database |
| `ai_analysis` | Run AI/ML analysis | Brain |
| `human_review` | Require human approval (gate) | Shield |
| `transformation` | Transform/process data | Zap |
| `export` | Export results | Upload |
| `notification` | Send notifications | Mail |
| `conditional` | Branch based on conditions | GitBranch |

## RBAC Permissions

| Role | View | Create | Edit | Publish | Delete | Set Policy |
|------|------|--------|------|---------|--------|------------|
| VIEWER | ✓ | - | - | - | - | - |
| RESEARCHER | ✓ | ✓ | - | - | - | - |
| STEWARD | ✓ | ✓ | ✓ | - | ✓ | - |
| ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## API Reference

### Workflows

#### List Workflows
\`\`\`
GET /api/workflows
Query: status?, limit?, offset?
Response: WorkflowSummary[]
\`\`\`

#### Create Workflow
\`\`\`
POST /api/workflows
Body: { name, description?, template_id? }
Response: Workflow
\`\`\`

#### Get Workflow
\`\`\`
GET /api/workflows/:id
Response: Workflow
\`\`\`

#### Update Workflow
\`\`\`
PATCH /api/workflows/:id
Body: { name?, description?, status? }
Response: Workflow
\`\`\`

#### Delete Workflow
\`\`\`
DELETE /api/workflows/:id
Response: { success: true }
\`\`\`

### Versions

#### List Versions
\`\`\`
GET /api/workflows/:id/versions
Response: WorkflowVersion[]
\`\`\`

#### Create Version
\`\`\`
POST /api/workflows/:id/versions
Body: { definition, change_summary? }
Response: WorkflowVersion
\`\`\`

#### Get Latest Version
\`\`\`
GET /api/workflows/:id/versions/latest
Response: WorkflowVersion
\`\`\`

#### Get Specific Version
\`\`\`
GET /api/workflows/:id/versions/:version
Response: WorkflowVersion
\`\`\`

### Templates

#### List Templates
\`\`\`
GET /api/workflows/templates
Query: category?
Response: WorkflowTemplate[]
\`\`\`

### Policies

#### Get Policy
\`\`\`
GET /api/workflows/:id/policy
Response: WorkflowPolicy
\`\`\`

#### Set Policy
\`\`\`
PUT /api/workflows/:id/policy
Body: { max_concurrent_runs?, require_approval?, allowed_stages? }
Response: WorkflowPolicy
\`\`\`

## DAG Compilation

The DAG compiler performs:

1. **Schema Validation** - Ensures all required fields are present
2. **Reference Validation** - Verifies edge source/target nodes exist
3. **Cycle Detection** - Uses DFS to detect circular dependencies
4. **Topological Sort** - Orders steps for execution

### Compiled Workflow Structure

\`\`\`python
@dataclass
class CompiledStep:
    node_id: str
    stage_type: str
    label: str
    config: Dict[str, Any]
    depends_on: List[str]
    order: int
    condition: Optional[str] = None
    is_gate: bool = False

@dataclass
class CompiledWorkflow:
    workflow_id: str
    version: int
    steps: List[CompiledStep]
    timeout_minutes: int
    retry_policy: str
    checkpoint_enabled: bool
\`\`\`

## DAG Execution

The DAG runner:

1. **Initializes Run State** - Creates or resumes from checkpoint
2. **Executes Steps** - In topological order
3. **Evaluates Conditions** - Skips steps based on conditions
4. **Handles Gates** - Pauses for human approval
5. **Saves Checkpoints** - After each step if enabled
6. **Manages Errors** - PHI-safe error handling

### Run States

| Status | Description |
|--------|-------------|
| `PENDING` | Workflow queued but not started |
| `IN_PROGRESS` | Currently executing |
| `WAITING_GATE` | Paused at human review gate |
| `COMPLETED` | All steps finished successfully |
| `FAILED` | Step failed, workflow stopped |
| `CANCELLED` | User cancelled execution |

## Checkpointing

Checkpoints enable:
- **Resumption** - Continue from last completed step
- **Recovery** - Restart after system failure
- **Long-running workflows** - Support multi-day workflows with human gates

### Checkpoint Structure

\`\`\`typescript
interface WorkflowRunCheckpoint {
  id: string;
  run_id: string;
  workflow_id: string;
  version: number;
  state: RunState;
  created_at: Date;
}

interface RunState {
  status: string;
  current_step: string;
  completed_steps: string[];
  step_outputs: Record<string, unknown>;
  failed_step?: string;
  error?: string;
}
\`\`\`

## Default Templates

| Template | Description | Stages |
|----------|-------------|--------|
| Standard Research | Full research pipeline | 5 |
| Quick Analysis | Fast analysis workflow | 3 |
| Conference Prep | Conference submission | 4 |
| Literature Review | Systematic review | 4 |

## Error Handling

### PHI Safety

All errors are sanitized to prevent PHI leakage:
- Exception messages are scrubbed
- Stack traces are not exposed
- Outputs are validated before storage

### Retry Policies

| Policy | Behavior |
|--------|----------|
| `none` | Fail immediately |
| `linear` | Retry with fixed delay |
| `exponential` | Retry with exponential backoff |

## Usage Example

### Creating a Workflow

1. Navigate to `/workflows`
2. Click "New Workflow"
3. Enter name and optional description
4. Optionally select a template
5. Click "Create Workflow"

### Building the DAG

1. Drag stages from the palette to the canvas
2. Connect stages by dragging from output to input
3. Click a stage to configure it
4. Save the workflow

### Publishing

1. Ensure all stages are configured
2. Click "Save" to create a new version
3. Click "Publish" (ADMIN only)
4. Workflow becomes ACTIVE

## Testing

### Unit Tests

\`\`\`bash
# Run DAG compiler tests
cd services/worker
pytest tests/test_dag_compiler.py -v

# Run DAG runner tests
pytest tests/test_dag_runner.py -v
\`\`\`

### Integration Tests

\`\`\`bash
# Test API endpoints
cd services/orchestrator
npm run test:integration
\`\`\`

## Migration

The workflow builder tables are created by migration `0007_phase_g_workflow_builder.sql`:

\`\`\`bash
# Apply migration
psql $DATABASE_URL < migrations/0007_phase_g_workflow_builder.sql
\`\`\`

## Future Enhancements

- [ ] Workflow execution history dashboard
- [ ] Real-time execution monitoring
- [ ] Workflow sharing between organizations
- [ ] Custom stage type plugins
- [ ] Workflow import/export
- [ ] Scheduled workflow execution
