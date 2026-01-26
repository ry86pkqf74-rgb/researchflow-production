"""
Tests for DAG Compiler

Tests the workflow DAG compiler including:
- Schema validation
- Cycle detection
- Topological sorting
- Error handling
"""
import pytest
from typing import Dict, Any

# Import the compiler (adjust path as needed)
import sys
sys.path.insert(0, '/Users/lhglosser/researchflow-production/services/worker')
from src.workflow_engine.dag_compiler import DAGCompiler, DAGValidationError, CompiledWorkflow


@pytest.fixture
def compiler():
    """Create a fresh DAG compiler instance."""
    return DAGCompiler()


@pytest.fixture
def simple_workflow() -> Dict[str, Any]:
    """A simple linear workflow: A -> B -> C"""
    return {
        "nodes": [
            {"id": "node_a", "type": "data_ingestion", "label": "Ingest Data", "config": {}},
            {"id": "node_b", "type": "ai_analysis", "label": "Analyze", "config": {}},
            {"id": "node_c", "type": "export", "label": "Export Results", "config": {}},
        ],
        "edges": [
            {"id": "e1", "source": "node_a", "target": "node_b"},
            {"id": "e2", "source": "node_b", "target": "node_c"},
        ],
        "settings": {
            "timeout_minutes": 60,
            "retry_policy": "exponential",
            "checkpoint_enabled": True,
        },
    }


@pytest.fixture
def branching_workflow() -> Dict[str, Any]:
    """A workflow with parallel branches: A -> B, A -> C, B -> D, C -> D"""
    return {
        "nodes": [
            {"id": "start", "type": "data_ingestion", "label": "Start", "config": {}},
            {"id": "branch1", "type": "ai_analysis", "label": "Branch 1", "config": {}},
            {"id": "branch2", "type": "transformation", "label": "Branch 2", "config": {}},
            {"id": "merge", "type": "export", "label": "Merge", "config": {}},
        ],
        "edges": [
            {"id": "e1", "source": "start", "target": "branch1"},
            {"id": "e2", "source": "start", "target": "branch2"},
            {"id": "e3", "source": "branch1", "target": "merge"},
            {"id": "e4", "source": "branch2", "target": "merge"},
        ],
        "settings": {
            "timeout_minutes": 30,
            "retry_policy": "none",
            "checkpoint_enabled": False,
        },
    }


@pytest.fixture
def cyclic_workflow() -> Dict[str, Any]:
    """A workflow with a cycle: A -> B -> C -> A"""
    return {
        "nodes": [
            {"id": "node_a", "type": "data_ingestion", "label": "A", "config": {}},
            {"id": "node_b", "type": "ai_analysis", "label": "B", "config": {}},
            {"id": "node_c", "type": "export", "label": "C", "config": {}},
        ],
        "edges": [
            {"id": "e1", "source": "node_a", "target": "node_b"},
            {"id": "e2", "source": "node_b", "target": "node_c"},
            {"id": "e3", "source": "node_c", "target": "node_a"},  # Creates cycle
        ],
        "settings": {
            "timeout_minutes": 60,
            "retry_policy": "exponential",
            "checkpoint_enabled": True,
        },
    }


class TestDAGCompilerValidation:
    """Tests for workflow schema validation."""

    def test_valid_workflow_passes_validation(self, compiler, simple_workflow):
        """Valid workflow should compile without errors."""
        result = compiler.compile(simple_workflow, "wf_123", 1)
        assert isinstance(result, CompiledWorkflow)
        assert result.workflow_id == "wf_123"
        assert result.version == 1

    def test_missing_nodes_fails_validation(self, compiler):
        """Workflow without nodes should fail validation."""
        invalid = {
            "edges": [],
            "settings": {"timeout_minutes": 60, "retry_policy": "none", "checkpoint_enabled": False},
        }
        with pytest.raises(DAGValidationError, match="nodes"):
            compiler.compile(invalid, "wf_123", 1)

    def test_missing_edges_fails_validation(self, compiler):
        """Workflow without edges should fail validation."""
        invalid = {
            "nodes": [{"id": "a", "type": "data_ingestion", "label": "A", "config": {}}],
            "settings": {"timeout_minutes": 60, "retry_policy": "none", "checkpoint_enabled": False},
        }
        with pytest.raises(DAGValidationError, match="edges"):
            compiler.compile(invalid, "wf_123", 1)

    def test_node_missing_id_fails(self, compiler):
        """Node without id should fail validation."""
        invalid = {
            "nodes": [{"type": "data_ingestion", "label": "A", "config": {}}],
            "edges": [],
            "settings": {"timeout_minutes": 60, "retry_policy": "none", "checkpoint_enabled": False},
        }
        with pytest.raises(DAGValidationError, match="id"):
            compiler.compile(invalid, "wf_123", 1)

    def test_edge_referencing_nonexistent_node_fails(self, compiler):
        """Edge referencing non-existent node should fail."""
        invalid = {
            "nodes": [{"id": "a", "type": "data_ingestion", "label": "A", "config": {}}],
            "edges": [{"id": "e1", "source": "a", "target": "nonexistent"}],
            "settings": {"timeout_minutes": 60, "retry_policy": "none", "checkpoint_enabled": False},
        }
        with pytest.raises(DAGValidationError, match="nonexistent"):
            compiler.compile(invalid, "wf_123", 1)


class TestDAGCompilerCycleDetection:
    """Tests for cycle detection in workflows."""

    def test_linear_workflow_has_no_cycles(self, compiler, simple_workflow):
        """Linear workflow should not be detected as cyclic."""
        result = compiler.compile(simple_workflow, "wf_123", 1)
        assert result is not None

    def test_branching_workflow_has_no_cycles(self, compiler, branching_workflow):
        """Branching workflow should not be detected as cyclic."""
        result = compiler.compile(branching_workflow, "wf_123", 1)
        assert result is not None

    def test_cyclic_workflow_raises_error(self, compiler, cyclic_workflow):
        """Cyclic workflow should raise DAGValidationError."""
        with pytest.raises(DAGValidationError, match="cycle"):
            compiler.compile(cyclic_workflow, "wf_123", 1)

    def test_self_loop_raises_error(self, compiler):
        """Node with edge to itself should raise error."""
        self_loop = {
            "nodes": [{"id": "a", "type": "data_ingestion", "label": "A", "config": {}}],
            "edges": [{"id": "e1", "source": "a", "target": "a"}],
            "settings": {"timeout_minutes": 60, "retry_policy": "none", "checkpoint_enabled": False},
        }
        with pytest.raises(DAGValidationError, match="cycle"):
            compiler.compile(self_loop, "wf_123", 1)


class TestDAGCompilerTopologicalSort:
    """Tests for topological sorting of workflow steps."""

    def test_linear_workflow_maintains_order(self, compiler, simple_workflow):
        """Linear workflow should maintain A -> B -> C order."""
        result = compiler.compile(simple_workflow, "wf_123", 1)
        step_ids = [s.node_id for s in result.steps]
        
        # A must come before B, B must come before C
        assert step_ids.index("node_a") < step_ids.index("node_b")
        assert step_ids.index("node_b") < step_ids.index("node_c")

    def test_branching_workflow_respects_dependencies(self, compiler, branching_workflow):
        """Branching workflow should have start first, merge last."""
        result = compiler.compile(branching_workflow, "wf_123", 1)
        step_ids = [s.node_id for s in result.steps]
        
        # Start must come first
        assert step_ids[0] == "start"
        # Merge must come last
        assert step_ids[-1] == "merge"
        # Branches can be in any order, but must come between start and merge

    def test_parallel_branches_can_run_concurrently(self, compiler, branching_workflow):
        """Parallel branches should have same dependencies."""
        result = compiler.compile(branching_workflow, "wf_123", 1)
        
        branch1_step = next(s for s in result.steps if s.node_id == "branch1")
        branch2_step = next(s for s in result.steps if s.node_id == "branch2")
        
        # Both branches depend only on start
        assert branch1_step.depends_on == ["start"]
        assert branch2_step.depends_on == ["start"]


class TestDAGCompilerCompiledOutput:
    """Tests for the compiled workflow output structure."""

    def test_compiled_workflow_has_all_steps(self, compiler, simple_workflow):
        """Compiled workflow should have same number of steps as nodes."""
        result = compiler.compile(simple_workflow, "wf_123", 1)
        assert len(result.steps) == len(simple_workflow["nodes"])

    def test_compiled_step_has_required_fields(self, compiler, simple_workflow):
        """Each compiled step should have required fields."""
        result = compiler.compile(simple_workflow, "wf_123", 1)
        
        for step in result.steps:
            assert step.node_id is not None
            assert step.stage_type is not None
            assert step.label is not None
            assert step.config is not None
            assert step.depends_on is not None
            assert step.order is not None

    def test_compiled_workflow_preserves_settings(self, compiler, simple_workflow):
        """Compiled workflow should preserve workflow settings."""
        result = compiler.compile(simple_workflow, "wf_123", 1)
        
        assert result.timeout_minutes == 60
        assert result.retry_policy == "exponential"
        assert result.checkpoint_enabled is True

    def test_step_order_is_sequential(self, compiler, simple_workflow):
        """Step orders should be sequential integers."""
        result = compiler.compile(simple_workflow, "wf_123", 1)
        orders = [s.order for s in result.steps]
        
        assert orders == list(range(len(orders)))


class TestDAGCompilerEdgeCases:
    """Tests for edge cases and special scenarios."""

    def test_single_node_workflow(self, compiler):
        """Workflow with single node should compile."""
        single = {
            "nodes": [{"id": "only", "type": "data_ingestion", "label": "Only", "config": {}}],
            "edges": [],
            "settings": {"timeout_minutes": 60, "retry_policy": "none", "checkpoint_enabled": False},
        }
        result = compiler.compile(single, "wf_123", 1)
        assert len(result.steps) == 1
        assert result.steps[0].depends_on == []

    def test_diamond_dependency_pattern(self, compiler):
        """Diamond pattern: A -> B, A -> C, B -> D, C -> D should work."""
        diamond = {
            "nodes": [
                {"id": "a", "type": "data_ingestion", "label": "A", "config": {}},
                {"id": "b", "type": "ai_analysis", "label": "B", "config": {}},
                {"id": "c", "type": "transformation", "label": "C", "config": {}},
                {"id": "d", "type": "export", "label": "D", "config": {}},
            ],
            "edges": [
                {"id": "e1", "source": "a", "target": "b"},
                {"id": "e2", "source": "a", "target": "c"},
                {"id": "e3", "source": "b", "target": "d"},
                {"id": "e4", "source": "c", "target": "d"},
            ],
            "settings": {"timeout_minutes": 60, "retry_policy": "none", "checkpoint_enabled": False},
        }
        result = compiler.compile(diamond, "wf_123", 1)
        
        d_step = next(s for s in result.steps if s.node_id == "d")
        assert set(d_step.depends_on) == {"b", "c"}

    def test_empty_config_is_allowed(self, compiler):
        """Nodes with empty config should compile."""
        workflow = {
            "nodes": [{"id": "a", "type": "data_ingestion", "label": "A", "config": {}}],
            "edges": [],
            "settings": {"timeout_minutes": 60, "retry_policy": "none", "checkpoint_enabled": False},
        }
        result = compiler.compile(workflow, "wf_123", 1)
        assert result.steps[0].config == {}

    def test_config_with_nested_data(self, compiler):
        """Nodes with complex nested config should compile."""
        workflow = {
            "nodes": [
                {
                    "id": "a",
                    "type": "ai_analysis",
                    "label": "A",
                    "config": {
                        "model": "gpt-4",
                        "parameters": {"temperature": 0.7, "max_tokens": 1000},
                        "prompts": ["prompt1", "prompt2"],
                    },
                }
            ],
            "edges": [],
            "settings": {"timeout_minutes": 60, "retry_policy": "none", "checkpoint_enabled": False},
        }
        result = compiler.compile(workflow, "wf_123", 1)
        assert result.steps[0].config["model"] == "gpt-4"
        assert result.steps[0].config["parameters"]["temperature"] == 0.7
