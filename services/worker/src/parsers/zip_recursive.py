"""
Recursive ZIP Archive Parser

Handles nested archives with safety limits.
"""

from __future__ import annotations

import os
import logging
import tempfile
import zipfile
from pathlib import Path
from typing import List, Dict, Any

from .registry import ParseResult, ParserRegistry

logger = logging.getLogger(__name__)

# Safety limits
MAX_RECURSION_DEPTH = 3
MAX_TOTAL_SIZE = 1024 * 1024 * 500  # 500 MB
MAX_FILES = 1000


def parse_zip_recursive(
    file_path: str,
    max_depth: int = MAX_RECURSION_DEPTH,
    max_size: int = MAX_TOTAL_SIZE,
    max_files: int = MAX_FILES
) -> ParseResult:
    """
    Recursively parse a ZIP archive and its contents.

    Args:
        file_path: Path to ZIP file
        max_depth: Maximum recursion depth for nested archives
        max_size: Maximum total extracted size in bytes
        max_files: Maximum number of files to extract

    Returns:
        ParseResult with parsed contents
    """
    try:
        parsed_files: List[Dict[str, Any]] = []
        total_size = 0
        file_count = 0
        errors: List[Dict[str, Any]] = []

        def _parse_archive(
            zip_path: str,
            depth: int,
            extract_dir: str
        ) -> None:
            nonlocal total_size, file_count

            if depth > max_depth:
                errors.append({
                    'path': zip_path,
                    'error': f'Max recursion depth ({max_depth}) exceeded'
                })
                return

            with zipfile.ZipFile(zip_path, 'r') as zf:
                for info in zf.infolist():
                    if file_count >= max_files:
                        errors.append({
                            'path': zip_path,
                            'error': f'Max file count ({max_files}) exceeded'
                        })
                        return

                    if total_size + info.file_size > max_size:
                        errors.append({
                            'path': info.filename,
                            'error': f'Max total size ({max_size} bytes) exceeded'
                        })
                        return

                    # Skip directories
                    if info.is_dir():
                        continue

                    # Extract file
                    extracted_path = zf.extract(info, extract_dir)
                    total_size += info.file_size
                    file_count += 1

                    file_ext = Path(info.filename).suffix.lower().lstrip('.')

                    # Check for nested archive
                    if file_ext in ('zip', 'tar', 'gz', 'tgz'):
                        if file_ext == 'zip':
                            nested_dir = tempfile.mkdtemp(dir=extract_dir)
                            _parse_archive(extracted_path, depth + 1, nested_dir)
                        else:
                            # Skip other archive types for now
                            parsed_files.append({
                                'filename': info.filename,
                                'size': info.file_size,
                                'format': file_ext,
                                'parsed': False,
                                'reason': 'Archive type not supported for recursion'
                            })
                        continue

                    # Try to parse the extracted file
                    parser = ParserRegistry.get_parser(file_ext)

                    if parser:
                        try:
                            result = parser(extracted_path)
                            parsed_files.append({
                                'filename': info.filename,
                                'size': info.file_size,
                                'format': file_ext,
                                'parsed': result.success,
                                'row_count': result.row_count,
                                'error': result.error
                            })
                        except Exception as e:
                            parsed_files.append({
                                'filename': info.filename,
                                'size': info.file_size,
                                'format': file_ext,
                                'parsed': False,
                                'error': str(e)
                            })
                    else:
                        parsed_files.append({
                            'filename': info.filename,
                            'size': info.file_size,
                            'format': file_ext,
                            'parsed': False,
                            'reason': 'No parser available'
                        })

        # Create temp directory for extraction
        with tempfile.TemporaryDirectory() as temp_dir:
            _parse_archive(file_path, 0, temp_dir)

        metadata = {
            'file_path': file_path,
            'file_size': Path(file_path).stat().st_size,
            'total_extracted_size': total_size,
            'file_count': file_count,
            'parsed_count': sum(1 for f in parsed_files if f.get('parsed')),
            'error_count': len(errors),
        }

        if errors:
            metadata['errors'] = errors

        return ParseResult(
            success=True,
            data={
                'files': parsed_files,
                'summary': {
                    'total_files': file_count,
                    'parsed_files': sum(1 for f in parsed_files if f.get('parsed')),
                    'total_size': total_size,
                }
            },
            metadata=metadata,
            format='zip',
            row_count=file_count
        )

    except zipfile.BadZipFile:
        return ParseResult(
            success=False,
            data=None,
            metadata={'file_path': file_path},
            format='zip',
            error='Invalid or corrupted ZIP file'
        )
    except Exception as e:
        logger.exception(f"Error parsing ZIP: {e}")
        return ParseResult(
            success=False,
            data=None,
            metadata={'file_path': file_path},
            format='zip',
            error=str(e)
        )


# Register the parser
ParserRegistry.register('zip', parse_zip_recursive)
