"""
Version Control Package

Git-based version tracking for statistical analysis and manuscripts.
Provides structured commit messages, history retrieval, diffs, and file restoration.
"""

from .models import (
    ProjectCreateRequest,
    ProjectInfo,
    CommitRequest,
    CommitResponse,
    CommitMetadata,
    HistoryEntry,
    HistoryResponse,
    DiffRequest,
    DiffResponse,
    RestoreRequest,
    RestoreResponse,
    SaveFileRequest,
    SaveFileResponse,
    ListFilesRequest,
    ListFilesResponse,
    FileCategory,
    FileInfo,
)

from .service import VersionControlService

__all__ = [
    # Models
    "ProjectCreateRequest",
    "ProjectInfo",
    "CommitRequest",
    "CommitResponse",
    "CommitMetadata",
    "HistoryEntry",
    "HistoryResponse",
    "DiffRequest",
    "DiffResponse",
    "RestoreRequest",
    "RestoreResponse",
    "SaveFileRequest",
    "SaveFileResponse",
    "ListFilesRequest",
    "ListFilesResponse",
    "FileCategory",
    "FileInfo",
    # Service
    "VersionControlService",
]
