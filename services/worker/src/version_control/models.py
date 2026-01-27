"""
Version Control Models

Pydantic models for version control requests and responses.
Supports structured commit messages with What/Why/Linked metadata.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


class FileCategory(str, Enum):
    """Categories for tracked files"""
    STATS = "stats"
    MANUSCRIPTS = "manuscripts"
    DATA = "data"
    OUTPUTS = "outputs"
    CONFIG = "config"
    OTHER = "other"


# ============================================
# Project Management
# ============================================

class ProjectCreateRequest(BaseModel):
    """Request to create a new version-controlled project"""
    project_id: str = Field(..., description="Unique project identifier")
    name: str = Field(..., description="Human-readable project name")
    description: Optional[str] = Field(None, description="Project description")
    owner_id: str = Field(..., description="User ID of project owner")
    owner_name: str = Field(..., description="Display name of owner")
    owner_email: str = Field(..., description="Email for Git commits")


class ProjectInfo(BaseModel):
    """Information about a project"""
    project_id: str
    name: str
    description: Optional[str] = None
    owner_id: str
    owner_name: str
    owner_email: str
    created_at: datetime
    last_modified: datetime
    commit_count: int = 0
    directories: List[str] = Field(
        default=["stats", "manuscripts", "data", "outputs"]
    )


# ============================================
# Commit Operations
# ============================================

class CommitMetadata(BaseModel):
    """Structured commit metadata following What/Why/Linked format"""
    what_changed: str = Field(..., description="What was changed")
    why_changed: Optional[str] = Field(None, description="Why this change was made")
    linked_analysis_id: Optional[str] = Field(None, description="Linked analysis ID")
    linked_manuscript_id: Optional[str] = Field(None, description="Linked manuscript ID")
    tags: List[str] = Field(default_factory=list, description="Tags for categorization")


class CommitRequest(BaseModel):
    """Request to create a commit"""
    project_id: str = Field(..., description="Project to commit to")
    file_paths: List[str] = Field(..., description="Files to include in commit")
    message: str = Field(..., description="Commit message (or use metadata for structured)")
    metadata: Optional[CommitMetadata] = Field(None, description="Structured commit metadata")
    author_name: str = Field(..., description="Author display name")
    author_email: str = Field(..., description="Author email")


class CommitResponse(BaseModel):
    """Response from a commit operation"""
    success: bool
    commit_sha: Optional[str] = None
    message: str
    files_committed: List[str] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ============================================
# History Operations
# ============================================

class HistoryEntry(BaseModel):
    """Single entry in version history"""
    commit_sha: str
    short_sha: str
    message: str
    author_name: str
    author_email: str
    timestamp: datetime
    files_changed: List[str] = Field(default_factory=list)
    additions: int = 0
    deletions: int = 0
    # Parsed metadata (if commit used structured format)
    metadata: Optional[CommitMetadata] = None


class HistoryResponse(BaseModel):
    """Response containing version history"""
    success: bool
    project_id: str
    file_path: Optional[str] = None  # If filtered by file
    entries: List[HistoryEntry] = Field(default_factory=list)
    total_count: int = 0
    has_more: bool = False


# ============================================
# Diff Operations
# ============================================

class DiffHunk(BaseModel):
    """A single diff hunk showing changes"""
    old_start: int
    old_lines: int
    new_start: int
    new_lines: int
    content: str


class FileDiff(BaseModel):
    """Diff for a single file"""
    file_path: str
    old_path: Optional[str] = None  # If renamed
    status: str  # added, modified, deleted, renamed
    hunks: List[DiffHunk] = Field(default_factory=list)
    additions: int = 0
    deletions: int = 0


class DiffRequest(BaseModel):
    """Request to get diff between versions"""
    project_id: str
    file_path: Optional[str] = None  # Specific file or entire commit
    commit_old: str = Field(..., description="Older commit SHA or 'HEAD~1'")
    commit_new: str = Field("HEAD", description="Newer commit SHA or 'HEAD'")


class DiffResponse(BaseModel):
    """Response containing diff information"""
    success: bool
    project_id: str
    commit_old: str
    commit_new: str
    files: List[FileDiff] = Field(default_factory=list)
    total_additions: int = 0
    total_deletions: int = 0


# ============================================
# Restore Operations
# ============================================

class RestoreRequest(BaseModel):
    """Request to restore a file to a previous version"""
    project_id: str
    file_path: str
    commit_sha: str = Field(..., description="Commit to restore from")
    create_backup: bool = Field(True, description="Create backup before restoring")
    author_name: str
    author_email: str


class RestoreResponse(BaseModel):
    """Response from restore operation"""
    success: bool
    message: str
    file_path: str
    restored_from_commit: str
    backup_path: Optional[str] = None
    new_commit_sha: Optional[str] = None


# ============================================
# File Save Operations (with auto-commit)
# ============================================

class SaveFileRequest(BaseModel):
    """Request to save a file with automatic versioning"""
    project_id: str
    file_path: str = Field(..., description="Relative path within project (e.g., 'stats/analysis.py')")
    content: str = Field(..., description="File content to save")
    author_name: str
    author_email: str
    message: Optional[str] = Field(None, description="Commit message (auto-generated if not provided)")
    metadata: Optional[CommitMetadata] = Field(None, description="Structured commit metadata")
    auto_commit: bool = Field(True, description="Automatically commit after save")


class SaveFileResponse(BaseModel):
    """Response from save file operation"""
    success: bool
    message: str
    file_path: str
    commit_sha: Optional[str] = None  # If auto_commit was True
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ============================================
# List/Browse Operations
# ============================================

class FileInfo(BaseModel):
    """Information about a tracked file"""
    path: str
    category: FileCategory
    size_bytes: int
    last_modified: datetime
    last_commit_sha: str
    last_commit_message: str


class ListFilesRequest(BaseModel):
    """Request to list files in a project"""
    project_id: str
    directory: Optional[str] = None  # Filter by directory
    category: Optional[FileCategory] = None  # Filter by category


class ListFilesResponse(BaseModel):
    """Response with list of tracked files"""
    success: bool
    project_id: str
    files: List[FileInfo] = Field(default_factory=list)
    total_count: int = 0
