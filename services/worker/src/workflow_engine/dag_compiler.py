"""
DAG Compiler

Compiles a WorkflowDefinition (JSON) into an executable plan.
Validates DAG structure, detects cycles, and produces topologically-sorted steps.

Usage:
    from workflow_engine.dag_compiler import DAGCompiler, DAGValidationError
    
    compiler = DAGCompiler()
    compiled = compiler.compile(definition, workflow_id='wf-123', version=1)
"""

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Any
from collections import defaultdict

logger = logging.getLogger("workflow_engine.dag_compiler")


@dataclass
class CompiledStep:
    """A single step in the compiled execution plan."""
    node_id: str
    node_type: str
    label: str
    stage_id: Optional[int] = None
    gate_type: Optional[str] = None
    depends_on: List[str] = field(default_factory=list)
    condition: Optional[Dict[str, Any]] = None
    parallel_group: Optional[str] = None
    config: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CompiledWorkflow:
    """The fully compiled workflow ready for execution."""
    workflow_id: str
    version: int
    steps: List[CompiledStep]
    entry_node_id: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def get_step(self, node_id: str) -> Optional[CompiledStep]:
        """Get a step by node ID."""
        for step in self.steps:
            if step.node_id == node_id:
                return step
        return None
    
    def get_entry_step(self) -> Optional[CompiledStep]:
        """Get the entry step."""
        return self.get_step(self.entry_node_id)


class DAGValidationError(Exception):
    """Raised when DAG validation fails."""
    pass


class DAGCompiler:
    """
    Compiles workflow definitions into executable plans.

    Responsibilities:
    - Validate DAG structure (no cycles unless explicitly allowed)
    - Topologically sort nodes
    - Resolve conditional edges
    - Group parallel nodes
    
    Example:
        compiler = DAGCompiler()
        try:
            compiled = compiler.compile(definition, 'wf-123', 1)
            for step in compiled.steps:
                print(f"Step: {step.node_id} ({step.node_type})")
        except DAGValidationError as e:
            print(f"Validation failed: {e}")
    """

    VALID_NODE_TYPES = {'stage', 'gate', 'branch', 'parallel', 'merge'}
    VALID_GATE_TYPES = {'ai_approval', 'phi_check', 'attestation'}
    VALID_CONDITION_KINDS = {'always', 'on_success', 'on_failure', 'expr'}
    MAX_STAGE_ID = 20
    MIN_STAGE_ID = 1

    def __init__(self, allow_cycles: bool = False):
        """
        Initialize the compiler.
        
        Args:
            allow_cycles: If True, allow cycles in the DAG (for loop constructs)
        """
        self.allow_cycles = allow_cycles

    def compile(
        self,
        definition: Dict[str, Any],
        workflow_id: str,
        version: int
    ) -> CompiledWorkflow:
        """
        Compile a workflow definition into an executable plan.

        Args:
            definition: The workflow definition JSON
            workflow_id: The workflow ID
            version: The workflow version

        Returns:
            CompiledWorkflow with topologically-sorted steps

        Raises:
            DAGValidationError: If validation fails
        """
        logger.info(f"Compiling workflow {workflow_id} v{version}")
        
        # Validate schema
        self._validate_schema(definition)

        nodes = {n["id"]: n for n in definition["nodes"]}
        edges = definition["edges"]
        entry_node_id = definition["entryNodeId"]

        # Build adjacency lists
        graph: Dict[str, List[str]] = defaultdict(list)
        reverse_graph: Dict[str, List[str]] = defaultdict(list)
        edge_conditions: Dict[str, Dict[str, Any]] = {}

        for edge in edges:
            from_id = edge["from"]
            to_id = edge["to"]
            
            # Validate edge endpoints exist
            if from_id not in nodes:
                raise DAGValidationError(f"Edge source '{from_id}' not found in nodes")
            if to_id not in nodes:
                raise DAGValidationError(f"Edge target '{to_id}' not found in nodes")
            
            graph[from_id].append(to_id)
            reverse_graph[to_id].append(from_id)

            if edge.get("condition"):
                edge_conditions[f"{from_id}->{to_id}"] = edge["condition"]

        # Validate entry node exists
        if entry_node_id not in nodes:
            raise DAGValidationError(f"Entry node '{entry_node_id}' not found in nodes")

        # Check for cycles
        if not self.allow_cycles:
            self._detect_cycles(set(nodes.keys()), graph)

        # Topological sort
        sorted_ids = self._topological_sort(set(nodes.keys()), graph, reverse_graph)

        # Identify parallel groups
        parallel_groups = self._identify_parallel_groups(nodes, edges)

        # Build compiled steps
        steps = []
        for node_id in sorted_ids:
            node = nodes[node_id]
            depends_on = reverse_graph.get(node_id, [])

            # Get condition from incoming edge (if single predecessor with condition)
            condition = None
            if len(depends_on) == 1:
                edge_key = f"{depends_on[0]}->{node_id}"
                condition = edge_conditions.get(edge_key)

            step = CompiledStep(
                node_id=node_id,
                node_type=node["type"],
                label=node.get("label", node_id),
                stage_id=node.get("stageId"),
                gate_type=node.get("gateType"),
                depends_on=list(depends_on),
                condition=condition,
                parallel_group=parallel_groups.get(node_id),
                config=node.get("config", {}),
            )
            steps.append(step)

        logger.info(f"Compiled workflow {workflow_id} v{version}: {len(steps)} steps")

        return CompiledWorkflow(
            workflow_id=workflow_id,
            version=version,
            steps=steps,
            entry_node_id=entry_node_id,
            metadata=definition.get("metadata", {}),
        )

    def _validate_schema(self, definition: Dict[str, Any]) -> None:
        """Validate the workflow definition schema."""
        # Check schema version
        schema_version = definition.get("schemaVersion")
        if schema_version != "1.0":
            raise DAGValidationError(
                f"Unsupported schema version: {schema_version}. Expected '1.0'"
            )

        # Check required fields
        if not definition.get("nodes"):
            raise DAGValidationError("Workflow must have at least one node")

        if not definition.get("entryNodeId"):
            raise DAGValidationError("Workflow must have an entryNodeId")

        # Validate each node
        node_ids = set()
        for node in definition["nodes"]:
            self._validate_node(node, node_ids)
            node_ids.add(node["id"])

        # Validate edges
        for edge in definition.get("edges", []):
            self._validate_edge(edge)

    def _validate_node(self, node: Dict[str, Any], existing_ids: Set[str]) -> None:
        """Validate a single node."""
        # Required fields
        if "id" not in node:
            raise DAGValidationError("All nodes must have an 'id' field")
        
        node_id = node["id"]
        if not isinstance(node_id, str) or not node_id.strip():
            raise DAGValidationError(f"Node id must be a non-empty string")
        
        if node_id in existing_ids:
            raise DAGValidationError(f"Duplicate node id: '{node_id}'")

        # Node type
        node_type = node.get("type")
        if node_type not in self.VALID_NODE_TYPES:
            raise DAGValidationError(
                f"Invalid node type '{node_type}' for node '{node_id}'. "
                f"Valid types: {self.VALID_NODE_TYPES}"
            )

        # Stage-specific validation
        if node_type == "stage":
            stage_id = node.get("stageId")
            if stage_id is None:
                raise DAGValidationError(
                    f"Stage node '{node_id}' must have a stageId"
                )
            if not isinstance(stage_id, int):
                raise DAGValidationError(
                    f"stageId must be an integer for node '{node_id}'")
            if stage_id < self.MIN_STAGE_ID or stage_id > self.MAX_STAGE_ID:
                raise DAGValidationError(
                    f"stageId must be {self.MIN_STAGE_ID}-{self.MAX_STAGE_ID}, "
                    f"got {stage_id} for node '{node_id}'"
                )

        # Gate-specific validation
        if node_type == "gate":
            gate_type = node.get("gateType")
            if gate_type and gate_type not in self.VALID_GATE_TYPES:
                raise DAGValidationError(
                    f"Invalid gate type '{gate_type}' for node '{node_id}'. "
                    f"Valid types: {self.VALID_GATE_TYPES}"
                )

    def _validate_edge(self, edge: Dict[str, Any]) -> None:
        """Validate a single edge."""
        if "id" not in edge:
            raise DAGValidationError("All edges must have an 'id' field")
        if "from" not in edge:
            raise DAGValidationError(f"Edge '{edge.get('id')}' missing 'from' field")
        if "to" not in edge:
            raise DAGValidationError(f"Edge '{edge.get('id')}' missing 'to' field")
        
        # Validate condition if present
        condition = edge.get("condition")
        if condition:
            kind = condition.get("kind")
            if kind not in self.VALID_CONDITION_KINDS:
                raise DAGValidationError(
                    f"Invalid condition kind '{kind}' for edge '{edge['id']}'. "
                    f"Valid kinds: {self.VALID_CONDITION_KINDS}"
                )
            
            # Warn about expr conditions (restricted)
            if kind == "expr" and condition.get("expr"):
                logger.warning(
                    f"Edge '{edge['id']}' uses 'expr' condition. "
                    "Expression evaluation is restricted for security."
                )

    def _detect_cycles(self, nodes: Set[str], graph: Dict[str, List[str]]) -> None:
        """Detect cycles using DFS with coloring."""
        WHITE, GRAY, BLACK = 0, 1, 2
        colors = {n: WHITE for n in nodes}
        cycle_path: List[str] = []

        def dfs(node: str) -> bool:
            colors[node] = GRAY
            cycle_path.append(node)
            
            for neighbor in graph.get(node, []):
                if colors[neighbor] == GRAY:
                    # Found cycle - build path
                    cycle_start = cycle_path.index(neighbor)
                    cycle = cycle_path[cycle_start:] + [neighbor]
                    raise DAGValidationError(
                        f"Cycle detected in workflow: {' -> '.join(cycle)}"
                    )
                if colors[neighbor] == WHITE and dfs(neighbor):
                    return True
            
            colors[node] = BLACK
            cycle_path.pop()
            return False

        for node in nodes:
            if colors[node] == WHITE:
                dfs(node)

    def _topological_sort(
        self,
        nodes: Set[str],
        graph: Dict[str, List[str]],
        reverse_graph: Dict[str, List[str]]
    ) -> List[str]:
        """Kahn's algorithm for topological sort."""
        in_degree = {n: len(reverse_graph.get(n, [])) for n in nodes}
        queue = [n for n in nodes if in_degree[n] == 0]
        result = []

        while queue:
            # Sort for deterministic ordering
            queue.sort()
            node = queue.pop(0)
            result.append(node)

            for neighbor in graph.get(node, []):
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        if len(result) != len(nodes):
            missing = nodes - set(result)
            raise DAGValidationError(
                f"Could not complete topological sort. "
                f"Unreachable nodes: {missing}"
            )

        return result

    def _identify_parallel_groups(
        self,
        nodes: Dict[str, Any],
        edges: List[Dict[str, Any]]
    ) -> Dict[str, str]:
        """
        Identify nodes that belong to parallel execution groups.
        A parallel group starts with a 'parallel' node and ends with a 'merge' node.
        """
        parallel_groups: Dict[str, str] = {}

        # Find parallel nodes
        parallel_nodes = [n for n in nodes.values() if n.get("type") == "parallel"]

        for parallel_node in parallel_nodes:
            group_id = parallel_node["id"]
            # Mark direct children as part of this parallel group
            for edge in edges:
                if edge["from"] == group_id:
                    parallel_groups[edge["to"]] = group_id

        return parallel_groups


# Convenience function for simple compilation
def compile_workflow(
    definition: Dict[str, Any],
    workflow_id: str,
    version: int,
    allow_cycles: bool = False
) -> CompiledWorkflow:
    """
    Convenience function to compile a workflow definition.
    
    Args:
        definition: The workflow definition JSON
        workflow_id: The workflow ID
        version: The workflow version
        allow_cycles: Whether to allow cycles
        
    Returns:
        CompiledWorkflow
    """
    compiler = DAGCompiler(allow_cycles=allow_cycles)
    return compiler.compile(definition, workflow_id, version)
