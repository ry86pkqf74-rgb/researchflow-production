"""
JSONL/NDJSON Parser
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import List, Dict, Any

from .registry import ParseResult, register_parser
from src.governance.output_phi_guard import guard_text

logger = logging.getLogger(__name__)


@register_parser('jsonl')
@register_parser('ndjson')
def parse_jsonl(file_path: str, fail_closed: bool = True) -> ParseResult:
    """
    Parse a JSONL/NDJSON file.

    Args:
        file_path: Path to JSONL file
        fail_closed: If True, skip lines with PHI

    Returns:
        ParseResult with list of parsed objects
    """
    try:
        records: List[Dict[str, Any]] = []
        errors: List[Dict[str, Any]] = []
        phi_blocked = 0

        with open(file_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue

                try:
                    obj = json.loads(line)

                    # PHI scan on string values
                    if fail_closed:
                        obj_str = json.dumps(obj)
                        _, findings = guard_text(obj_str, fail_closed=True)
                        if findings:
                            phi_blocked += 1
                            continue

                    records.append(obj)

                except json.JSONDecodeError as e:
                    errors.append({
                        'line': line_num,
                        'error': str(e)
                    })

        # Try to convert to DataFrame if records are uniform
        df = None
        if records:
            try:
                import pandas as pd
                df = pd.DataFrame(records)
            except Exception:
                pass

        metadata = {
            'file_path': file_path,
            'file_size': Path(file_path).stat().st_size,
            'record_count': len(records),
            'error_count': len(errors),
            'phi_blocked_count': phi_blocked,
        }

        if errors:
            metadata['parse_errors'] = errors[:10]  # Limit

        return ParseResult(
            success=True,
            data=df if df is not None else records,
            metadata=metadata,
            format='jsonl',
            row_count=len(records)
        )

    except Exception as e:
        logger.exception(f"Error parsing JSONL: {e}")
        return ParseResult(
            success=False,
            data=None,
            metadata={'file_path': file_path},
            format='jsonl',
            error=str(e)
        )
