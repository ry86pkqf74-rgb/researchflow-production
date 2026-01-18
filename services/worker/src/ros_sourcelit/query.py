"""
ROS Sourcelit Query Engine

Executes queries against index, returns paths + line numbers only.
No file content exposure in STANDBY mode.

Last Updated: 2026-01-08
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Any


def execute_query(
    query: str, index_path: str = ".tmp/sourcelit/index.json", mode: str = None
) -> Dict[str, Any]:
    """
    Execute query against index.

    Args:
        query: Search query string
        index_path: Path to index.json
        mode: Override mode (STANDBY, SANDBOX, ACTIVE)

    Returns:
        Query result with paths + line numbers only (no content in STANDBY)
    """
    # Determine mode
    if mode is None:
        if os.getenv("MOCK_ONLY", "0") == "1":
            mode = "STANDBY"
        else:
            mode = "ACTIVE"

    # Load index
    index_file = Path(index_path)
    if not index_file.exists():
        return {
            "query": query,
            "mode": mode.lower(),
            "results": [],
            "error": f"Index not found: {index_path}",
            "content_policy": {
                "expose_file_content": False,
                "max_snippet_chars": 0,
            },
            "is_mock": False,
        }

    with open(index_file, "r") as f:
        index = json.load(f)

    # Search entries
    results = []
    query_lower = query.lower()

    for entry in index.get("entries", []):
        path = entry.get("path", "")

        # Simple keyword matching
        if query_lower in path.lower():
            result = {
                "type": "path_match",
                "path": path,
                "sha256": entry.get("sha256"),
                "line": None,  # Could add line number search later
                "snippet": None,  # CRITICAL: No snippets in STANDBY
                "relevance_score": 1.0 if query_lower == path.lower() else 0.5,
            }
            results.append(result)

    # Sort by relevance
    results.sort(key=lambda r: r["relevance_score"], reverse=True)

    # Build response
    response = {
        "query": query,
        "mode": mode.lower(),
        "results": results[:20],  # Limit to top 20
        "content_policy": {
            "expose_file_content": False,
            "max_snippet_chars": 0 if mode == "STANDBY" else 0,
        },
        "is_mock": False,
        "index_hash": index.get("index_hash"),
    }

    return response


def main():
    """CLI entrypoint."""
    import argparse

    parser = argparse.ArgumentParser(description="Query ROS Sourcelit index")
    parser.add_argument(
        "--index", default=".tmp/sourcelit/index.json", help="Path to index.json"
    )
    parser.add_argument("--query", required=True, help="Search query")
    parser.add_argument(
        "--mode", choices=["STANDBY", "ACTIVE", "SANDBOX"], help="Override mode"
    )
    args = parser.parse_args()

    result = execute_query(args.query, args.index, args.mode)

    print(json.dumps(result, indent=2))

    if result.get("results"):
        print(f"\n✓ Found {len(result['results'])} matches")
    else:
        print("\n⚠️  No matches found")


if __name__ == "__main__":
    main()
