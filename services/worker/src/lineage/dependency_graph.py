"""
Data Dependency Graph Generator

Creates visual and structured representations of data lineage.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Set
from pathlib import Path
import hashlib

logger = logging.getLogger(__name__)


@dataclass
class LineageNode:
    """Node in the dependency graph"""
    id: str
    name: str
    node_type: str  # source, transform, output, artifact
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: Optional[str] = None


@dataclass
class LineageEdge:
    """Edge in the dependency graph"""
    source_id: str
    target_id: str
    relationship: str  # derives_from, transforms_to, produces
    metadata: Dict[str, Any] = field(default_factory=dict)


class DependencyGraph:
    """
    Tracks and visualizes data dependencies.

    Features:
    - Add nodes and edges
    - Generate Mermaid diagram
    - Export to JSON
    - Validate graph integrity
    """

    def __init__(self):
        self.nodes: Dict[str, LineageNode] = {}
        self.edges: List[LineageEdge] = []

    def add_node(
        self,
        name: str,
        node_type: str,
        node_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Add a node to the graph.

        Args:
            name: Node name
            node_type: Type of node
            node_id: Optional custom ID (generated if not provided)
            metadata: Optional metadata

        Returns:
            Node ID
        """
        if node_id is None:
            node_id = self._generate_id(name, node_type)

        self.nodes[node_id] = LineageNode(
            id=node_id,
            name=name,
            node_type=node_type,
            metadata=metadata or {},
            created_at=datetime.utcnow().isoformat()
        )

        return node_id

    def add_edge(
        self,
        source_id: str,
        target_id: str,
        relationship: str = "derives_from",
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Add an edge between nodes"""
        if source_id not in self.nodes:
            raise ValueError(f"Source node '{source_id}' not found")
        if target_id not in self.nodes:
            raise ValueError(f"Target node '{target_id}' not found")

        self.edges.append(LineageEdge(
            source_id=source_id,
            target_id=target_id,
            relationship=relationship,
            metadata=metadata or {}
        ))

    def _generate_id(self, name: str, node_type: str) -> str:
        """Generate a unique ID for a node"""
        content = f"{name}:{node_type}:{datetime.utcnow().isoformat()}"
        return hashlib.sha256(content.encode()).hexdigest()[:12]

    def to_mermaid(self) -> str:
        """
        Generate Mermaid diagram syntax.

        Returns:
            Mermaid flowchart string
        """
        lines = ["flowchart TD"]

        # Define node styles by type
        styles = {
            'source': 'fill:#e1f5fe',
            'transform': 'fill:#fff3e0',
            'output': 'fill:#e8f5e9',
            'artifact': 'fill:#fce4ec',
        }

        # Add nodes
        for node_id, node in self.nodes.items():
            # Sanitize name for Mermaid
            safe_name = node.name.replace('"', "'").replace('\n', ' ')[:50]
            shape_start, shape_end = self._get_shape(node.node_type)
            lines.append(f"    {node_id}{shape_start}\"{safe_name}\"{shape_end}")

        # Add edges
        for edge in self.edges:
            arrow = self._get_arrow(edge.relationship)
            lines.append(f"    {edge.source_id} {arrow} {edge.target_id}")

        # Add style classes
        for node_type, style in styles.items():
            node_ids = [n.id for n in self.nodes.values() if n.node_type == node_type]
            if node_ids:
                lines.append(f"    classDef {node_type} {style}")
                for nid in node_ids:
                    lines.append(f"    class {nid} {node_type}")

        return "\n".join(lines)

    def _get_shape(self, node_type: str) -> tuple:
        """Get Mermaid shape for node type"""
        shapes = {
            'source': ('[', ']'),      # Rectangle
            'transform': ('((', '))'),  # Circle
            'output': ('[[', ']]'),     # Stadium
            'artifact': ('{{', '}}'),   # Hexagon
        }
        return shapes.get(node_type, ('[', ']'))

    def _get_arrow(self, relationship: str) -> str:
        """Get Mermaid arrow for relationship"""
        arrows = {
            'derives_from': '-->',
            'transforms_to': '==>',
            'produces': '-.->',
        }
        return arrows.get(relationship, '-->')

    def to_json(self) -> Dict[str, Any]:
        """Export graph to JSON structure"""
        return {
            'nodes': [
                {
                    'id': n.id,
                    'name': n.name,
                    'type': n.node_type,
                    'metadata': n.metadata,
                    'created_at': n.created_at
                }
                for n in self.nodes.values()
            ],
            'edges': [
                {
                    'source': e.source_id,
                    'target': e.target_id,
                    'relationship': e.relationship,
                    'metadata': e.metadata
                }
                for e in self.edges
            ],
            'generated_at': datetime.utcnow().isoformat()
        }

    def validate(self) -> List[str]:
        """
        Validate graph integrity.

        Returns:
            List of validation errors (empty if valid)
        """
        errors = []

        # Check for orphan nodes
        connected_nodes: Set[str] = set()
        for edge in self.edges:
            connected_nodes.add(edge.source_id)
            connected_nodes.add(edge.target_id)

        orphans = set(self.nodes.keys()) - connected_nodes
        if orphans and len(self.nodes) > 1:
            errors.append(f"Orphan nodes: {orphans}")

        # Check for cycles (simple check)
        # Full cycle detection would require topological sort

        return errors


def generate_lineage_graph(
    operations: List[Dict[str, Any]]
) -> DependencyGraph:
    """
    Generate a lineage graph from a list of operations.

    Args:
        operations: List of operation dictionaries with:
            - name: Operation name
            - type: Operation type
            - inputs: List of input names
            - outputs: List of output names

    Returns:
        DependencyGraph
    """
    graph = DependencyGraph()
    name_to_id: Dict[str, str] = {}

    for op in operations:
        op_name = op.get('name', 'Unknown')
        op_type = op.get('type', 'transform')
        inputs = op.get('inputs', [])
        outputs = op.get('outputs', [])

        # Add operation node
        op_id = graph.add_node(op_name, op_type, metadata=op.get('metadata', {}))

        # Add input nodes and edges
        for inp in inputs:
            if inp not in name_to_id:
                inp_id = graph.add_node(inp, 'source')
                name_to_id[inp] = inp_id
            graph.add_edge(name_to_id[inp], op_id, 'transforms_to')

        # Add output nodes and edges
        for out in outputs:
            if out not in name_to_id:
                out_id = graph.add_node(out, 'output')
                name_to_id[out] = out_id
            graph.add_edge(op_id, name_to_id[out], 'produces')

    return graph


def save_lineage_artifacts(
    graph: DependencyGraph,
    output_dir: str
) -> Dict[str, str]:
    """
    Save lineage graph as artifacts.

    Args:
        graph: DependencyGraph to save
        output_dir: Output directory

    Returns:
        Dictionary with paths to saved files
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    paths = {}

    # Save Mermaid
    mmd_path = output_path / "dependency_graph.mmd"
    with open(mmd_path, 'w') as f:
        f.write(graph.to_mermaid())
    paths['mermaid'] = str(mmd_path)

    # Save JSON
    json_path = output_path / "dependency_graph.json"
    with open(json_path, 'w') as f:
        json.dump(graph.to_json(), f, indent=2)
    paths['json'] = str(json_path)

    return paths
