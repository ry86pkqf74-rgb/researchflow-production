"""
Version Control Service

Git-based version tracking for statistical analysis and manuscripts.
Uses GitPython for operations with structured commit messages.
"""

import os
import re
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Tuple
import shutil

from git import Repo, InvalidGitRepositoryError, GitCommandError
from git.exc import BadName

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
    DiffHunk,
    FileDiff,
    RestoreRequest,
    RestoreResponse,
    SaveFileRequest,
    SaveFileResponse,
    FileCategory,
    FileInfo,
    ListFilesRequest,
    ListFilesResponse,
)

logger = logging.getLogger(__name__)

# Base path for project repositories
PROJECTS_BASE_PATH = os.environ.get("PROJECTS_PATH", "/data/projects")


class VersionControlService:
    """
    Git-based version control service for ResearchFlow projects.

    Features:
    - Project creation with standard directory structure
    - Structured commit messages (What/Why/Linked)
    - History retrieval with parsed metadata
    - File diffs between versions
    - File restoration to previous versions
    - Auto-commit on file save
    """

    def __init__(self, base_path: Optional[str] = None):
        """Initialize the version control service."""
        self.base_path = Path(base_path or PROJECTS_BASE_PATH)
        self.base_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"VersionControlService initialized with base path: {self.base_path}")

    def _get_project_path(self, project_id: str) -> Path:
        """Get the filesystem path for a project."""
        # Sanitize project_id to prevent path traversal
        safe_id = re.sub(r'[^a-zA-Z0-9_-]', '_', project_id)
        return self.base_path / safe_id

    def _get_repo(self, project_id: str) -> Repo:
        """Get the Git repository for a project."""
        project_path = self._get_project_path(project_id)
        if not project_path.exists():
            raise ValueError(f"Project not found: {project_id}")
        try:
            return Repo(project_path)
        except InvalidGitRepositoryError:
            raise ValueError(f"Project {project_id} is not a valid Git repository")

    def _format_structured_message(self, metadata: CommitMetadata) -> str:
        """Format a structured commit message from metadata."""
        lines = [metadata.what_changed]

        if metadata.why_changed:
            lines.append(f"\nWhy: {metadata.why_changed}")

        if metadata.linked_analysis_id:
            lines.append(f"\nLinked-Analysis: {metadata.linked_analysis_id}")

        if metadata.linked_manuscript_id:
            lines.append(f"\nLinked-Manuscript: {metadata.linked_manuscript_id}")

        if metadata.tags:
            lines.append(f"\nTags: {', '.join(metadata.tags)}")

        return '\n'.join(lines)

    def _parse_commit_metadata(self, message: str) -> Optional[CommitMetadata]:
        """Parse structured metadata from a commit message."""
        try:
            lines = message.split('\n')
            what_changed = lines[0] if lines else message

            why_changed = None
            linked_analysis_id = None
            linked_manuscript_id = None
            tags = []

            for line in lines[1:]:
                line = line.strip()
                if line.startswith('Why:'):
                    why_changed = line[4:].strip()
                elif line.startswith('Linked-Analysis:'):
                    linked_analysis_id = line[16:].strip()
                elif line.startswith('Linked-Manuscript:'):
                    linked_manuscript_id = line[18:].strip()
                elif line.startswith('Tags:'):
                    tags = [t.strip() for t in line[5:].split(',')]

            return CommitMetadata(
                what_changed=what_changed,
                why_changed=why_changed,
                linked_analysis_id=linked_analysis_id,
                linked_manuscript_id=linked_manuscript_id,
                tags=tags
            )
        except Exception as e:
            logger.debug(f"Could not parse commit metadata: {e}")
            return None

    def _get_file_category(self, file_path: str) -> FileCategory:
        """Determine the category of a file based on its path."""
        path_lower = file_path.lower()
        if path_lower.startswith('stats/') or path_lower.endswith('.py'):
            return FileCategory.STATS
        elif path_lower.startswith('manuscripts/') or any(path_lower.endswith(ext) for ext in ['.md', '.docx', '.tex']):
            return FileCategory.MANUSCRIPTS
        elif path_lower.startswith('data/') or any(path_lower.endswith(ext) for ext in ['.csv', '.xlsx', '.json']):
            return FileCategory.DATA
        elif path_lower.startswith('outputs/') or any(path_lower.endswith(ext) for ext in ['.pdf', '.png', '.html']):
            return FileCategory.OUTPUTS
        elif any(path_lower.endswith(ext) for ext in ['.yml', '.yaml', '.toml', '.ini', '.cfg']):
            return FileCategory.CONFIG
        return FileCategory.OTHER

    # ============================================
    # Project Management
    # ============================================

    def create_project(self, request: ProjectCreateRequest) -> ProjectInfo:
        """
        Create a new version-controlled project with standard directory structure.

        Directory structure:
        - stats/        - Statistical analysis scripts and code
        - manuscripts/  - Manuscript drafts and documents
        - data/         - Dataset files (tracked or .gitignored)
        - outputs/      - Generated outputs (figures, tables, reports)
        """
        project_path = self._get_project_path(request.project_id)

        if project_path.exists():
            raise ValueError(f"Project already exists: {request.project_id}")

        # Create project directory and standard subdirectories
        project_path.mkdir(parents=True)
        directories = ["stats", "manuscripts", "data", "outputs"]
        for subdir in directories:
            (project_path / subdir).mkdir()
            # Create .gitkeep to track empty directories
            (project_path / subdir / ".gitkeep").touch()

        # Initialize Git repository
        repo = Repo.init(project_path)

        # Configure Git user for this repository
        with repo.config_writer() as config:
            config.set_value("user", "name", request.owner_name)
            config.set_value("user", "email", request.owner_email)

        # Create .gitignore
        gitignore_content = """# ResearchFlow Project .gitignore

# Large data files (track metadata, not raw data)
data/*.csv.gz
data/*.parquet
data/raw/

# Temporary files
*.tmp
*.temp
.DS_Store
__pycache__/
*.pyc

# IDE
.vscode/
.idea/

# Output artifacts (regeneratable)
outputs/temp/

# Sensitive data
*.env
.env.local
credentials/
"""
        (project_path / ".gitignore").write_text(gitignore_content)

        # Create README
        readme_content = f"""# {request.name}

{request.description or 'A ResearchFlow version-controlled project.'}

## Project Structure

- `stats/` - Statistical analysis scripts and code
- `manuscripts/` - Manuscript drafts and documents
- `data/` - Dataset files
- `outputs/` - Generated outputs (figures, tables, reports)

## Owner

- **Name:** {request.owner_name}
- **Email:** {request.owner_email}

Created: {datetime.utcnow().isoformat()}
"""
        (project_path / "README.md").write_text(readme_content)

        # Initial commit
        repo.index.add([".gitignore", "README.md"] + [f"{d}/.gitkeep" for d in directories])
        repo.index.commit(
            "Initial project setup\n\nWhat changed: Created project with standard directory structure",
            author=f"{request.owner_name} <{request.owner_email}>"
        )

        logger.info(f"Created project: {request.project_id} at {project_path}")

        return ProjectInfo(
            project_id=request.project_id,
            name=request.name,
            description=request.description,
            owner_id=request.owner_id,
            owner_name=request.owner_name,
            owner_email=request.owner_email,
            created_at=datetime.utcnow(),
            last_modified=datetime.utcnow(),
            commit_count=1,
            directories=directories
        )

    def get_project_info(self, project_id: str) -> ProjectInfo:
        """Get information about a project."""
        repo = self._get_repo(project_id)
        project_path = self._get_project_path(project_id)

        # Read project metadata from README or config
        readme_path = project_path / "README.md"
        name = project_id
        description = None
        owner_name = "Unknown"
        owner_email = "unknown@example.com"

        if readme_path.exists():
            content = readme_path.read_text()
            # Parse basic info from README
            lines = content.split('\n')
            if lines and lines[0].startswith('# '):
                name = lines[0][2:].strip()

        # Get owner info from Git config
        try:
            with repo.config_reader() as config:
                owner_name = config.get_value("user", "name", "Unknown")
                owner_email = config.get_value("user", "email", "unknown@example.com")
        except Exception:
            pass

        # Get commit stats
        commit_count = sum(1 for _ in repo.iter_commits())

        # Get timestamps
        first_commit = list(repo.iter_commits())[-1] if commit_count > 0 else None
        last_commit = repo.head.commit if commit_count > 0 else None

        created_at = datetime.fromtimestamp(first_commit.committed_date) if first_commit else datetime.utcnow()
        last_modified = datetime.fromtimestamp(last_commit.committed_date) if last_commit else datetime.utcnow()

        # Get directories
        directories = [d.name for d in project_path.iterdir() if d.is_dir() and not d.name.startswith('.')]

        return ProjectInfo(
            project_id=project_id,
            name=name,
            description=description,
            owner_id="",  # Not stored in Git
            owner_name=owner_name,
            owner_email=owner_email,
            created_at=created_at,
            last_modified=last_modified,
            commit_count=commit_count,
            directories=directories
        )

    def list_projects(self) -> List[ProjectInfo]:
        """List all projects."""
        projects = []
        for project_dir in self.base_path.iterdir():
            if project_dir.is_dir() and (project_dir / ".git").exists():
                try:
                    projects.append(self.get_project_info(project_dir.name))
                except Exception as e:
                    logger.warning(f"Could not load project {project_dir.name}: {e}")
        return projects

    # ============================================
    # Commit Operations
    # ============================================

    def commit(self, request: CommitRequest) -> CommitResponse:
        """Create a commit with the specified files."""
        try:
            repo = self._get_repo(request.project_id)
            project_path = self._get_project_path(request.project_id)

            # Verify files exist and are tracked or new
            valid_files = []
            for file_path in request.file_paths:
                full_path = project_path / file_path
                if full_path.exists():
                    valid_files.append(file_path)
                else:
                    logger.warning(f"File not found, skipping: {file_path}")

            if not valid_files:
                return CommitResponse(
                    success=False,
                    message="No valid files to commit"
                )

            # Stage files
            repo.index.add(valid_files)

            # Build commit message
            if request.metadata:
                message = self._format_structured_message(request.metadata)
            else:
                message = request.message

            # Create commit
            commit = repo.index.commit(
                message,
                author=f"{request.author_name} <{request.author_email}>"
            )

            logger.info(f"Created commit {commit.hexsha[:8]} in project {request.project_id}")

            return CommitResponse(
                success=True,
                commit_sha=commit.hexsha,
                message=f"Committed {len(valid_files)} file(s)",
                files_committed=valid_files,
                timestamp=datetime.fromtimestamp(commit.committed_date)
            )

        except Exception as e:
            logger.error(f"Commit failed: {e}")
            return CommitResponse(
                success=False,
                message=f"Commit failed: {str(e)}"
            )

    # ============================================
    # History Operations
    # ============================================

    def get_history(
        self,
        project_id: str,
        file_path: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> HistoryResponse:
        """Get commit history for a project or specific file."""
        try:
            repo = self._get_repo(project_id)

            # Build commit iterator
            if file_path:
                commits = list(repo.iter_commits(paths=file_path, max_count=limit + offset + 1))
            else:
                commits = list(repo.iter_commits(max_count=limit + offset + 1))

            # Apply offset
            commits = commits[offset:]
            has_more = len(commits) > limit
            commits = commits[:limit]

            entries = []
            for commit in commits:
                # Get files changed in this commit
                files_changed = []
                try:
                    if commit.parents:
                        diff = commit.parents[0].diff(commit)
                        files_changed = [d.a_path or d.b_path for d in diff]
                except Exception:
                    pass

                # Parse metadata from message
                metadata = self._parse_commit_metadata(commit.message)

                entries.append(HistoryEntry(
                    commit_sha=commit.hexsha,
                    short_sha=commit.hexsha[:8],
                    message=commit.message,
                    author_name=commit.author.name,
                    author_email=commit.author.email,
                    timestamp=datetime.fromtimestamp(commit.committed_date),
                    files_changed=files_changed,
                    additions=commit.stats.total.get('insertions', 0),
                    deletions=commit.stats.total.get('deletions', 0),
                    metadata=metadata
                ))

            return HistoryResponse(
                success=True,
                project_id=project_id,
                file_path=file_path,
                entries=entries,
                total_count=len(entries),
                has_more=has_more
            )

        except Exception as e:
            logger.error(f"Get history failed: {e}")
            return HistoryResponse(
                success=False,
                project_id=project_id,
                file_path=file_path
            )

    # ============================================
    # Diff Operations
    # ============================================

    def get_diff(self, request: DiffRequest) -> DiffResponse:
        """Get diff between two versions."""
        try:
            repo = self._get_repo(request.project_id)

            # Resolve commit references
            try:
                old_commit = repo.commit(request.commit_old)
                new_commit = repo.commit(request.commit_new)
            except BadName as e:
                return DiffResponse(
                    success=False,
                    project_id=request.project_id,
                    commit_old=request.commit_old,
                    commit_new=request.commit_new
                )

            # Get diff
            if request.file_path:
                diffs = old_commit.diff(new_commit, paths=[request.file_path])
            else:
                diffs = old_commit.diff(new_commit)

            files = []
            total_additions = 0
            total_deletions = 0

            for diff in diffs:
                file_path = diff.b_path or diff.a_path

                # Determine status
                if diff.new_file:
                    status = "added"
                elif diff.deleted_file:
                    status = "deleted"
                elif diff.renamed_file:
                    status = "renamed"
                else:
                    status = "modified"

                # Parse hunks from diff text
                hunks = []
                try:
                    diff_text = diff.diff.decode('utf-8') if diff.diff else ""
                    # Simple hunk parsing
                    hunk_pattern = r'@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@'
                    for match in re.finditer(hunk_pattern, diff_text):
                        # Extract hunk content (simplified)
                        hunks.append(DiffHunk(
                            old_start=int(match.group(1)),
                            old_lines=int(match.group(2) or 1),
                            new_start=int(match.group(3)),
                            new_lines=int(match.group(4) or 1),
                            content=""  # Full content parsing would be more complex
                        ))
                except Exception:
                    pass

                # Count additions/deletions (simplified)
                additions = sum(h.new_lines for h in hunks)
                deletions = sum(h.old_lines for h in hunks)
                total_additions += additions
                total_deletions += deletions

                files.append(FileDiff(
                    file_path=file_path,
                    old_path=diff.a_path if diff.renamed_file else None,
                    status=status,
                    hunks=hunks,
                    additions=additions,
                    deletions=deletions
                ))

            return DiffResponse(
                success=True,
                project_id=request.project_id,
                commit_old=old_commit.hexsha,
                commit_new=new_commit.hexsha,
                files=files,
                total_additions=total_additions,
                total_deletions=total_deletions
            )

        except Exception as e:
            logger.error(f"Get diff failed: {e}")
            return DiffResponse(
                success=False,
                project_id=request.project_id,
                commit_old=request.commit_old,
                commit_new=request.commit_new
            )

    # ============================================
    # Restore Operations
    # ============================================

    def restore_version(self, request: RestoreRequest) -> RestoreResponse:
        """Restore a file to a previous version."""
        try:
            repo = self._get_repo(request.project_id)
            project_path = self._get_project_path(request.project_id)
            file_full_path = project_path / request.file_path

            # Create backup if requested
            backup_path = None
            if request.create_backup and file_full_path.exists():
                backup_name = f"{request.file_path}.backup.{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
                backup_path = project_path / backup_name
                shutil.copy2(file_full_path, backup_path)
                repo.index.add([backup_name])

            # Get file content from specified commit
            try:
                commit = repo.commit(request.commit_sha)
                blob = commit.tree / request.file_path
                file_content = blob.data_stream.read()
            except (BadName, KeyError) as e:
                return RestoreResponse(
                    success=False,
                    message=f"Could not find file at commit {request.commit_sha}: {e}",
                    file_path=request.file_path,
                    restored_from_commit=request.commit_sha
                )

            # Write restored content
            file_full_path.parent.mkdir(parents=True, exist_ok=True)
            file_full_path.write_bytes(file_content)

            # Commit the restoration
            repo.index.add([request.file_path])
            commit_message = f"Restore {request.file_path} from {request.commit_sha[:8]}\n\nWhat changed: Restored file to version from commit {request.commit_sha[:8]}"

            new_commit = repo.index.commit(
                commit_message,
                author=f"{request.author_name} <{request.author_email}>"
            )

            logger.info(f"Restored {request.file_path} from {request.commit_sha[:8]} in project {request.project_id}")

            return RestoreResponse(
                success=True,
                message=f"Successfully restored {request.file_path}",
                file_path=request.file_path,
                restored_from_commit=request.commit_sha,
                backup_path=str(backup_path) if backup_path else None,
                new_commit_sha=new_commit.hexsha
            )

        except Exception as e:
            logger.error(f"Restore failed: {e}")
            return RestoreResponse(
                success=False,
                message=f"Restore failed: {str(e)}",
                file_path=request.file_path,
                restored_from_commit=request.commit_sha
            )

    # ============================================
    # File Save Operations
    # ============================================

    def save_file(self, request: SaveFileRequest) -> SaveFileResponse:
        """Save a file with automatic versioning."""
        try:
            project_path = self._get_project_path(request.project_id)
            file_full_path = project_path / request.file_path

            # Ensure directory exists
            file_full_path.parent.mkdir(parents=True, exist_ok=True)

            # Determine if this is a new file or modification
            is_new = not file_full_path.exists()

            # Write content
            file_full_path.write_text(request.content)

            commit_sha = None
            if request.auto_commit:
                repo = self._get_repo(request.project_id)
                repo.index.add([request.file_path])

                # Build commit message
                if request.metadata:
                    message = self._format_structured_message(request.metadata)
                elif request.message:
                    message = request.message
                else:
                    action = "Add" if is_new else "Update"
                    message = f"{action} {request.file_path}\n\nWhat changed: {'Created new file' if is_new else 'Modified file'}"

                commit = repo.index.commit(
                    message,
                    author=f"{request.author_name} <{request.author_email}>"
                )
                commit_sha = commit.hexsha
                logger.info(f"Saved and committed {request.file_path} in project {request.project_id}")
            else:
                logger.info(f"Saved {request.file_path} in project {request.project_id} (no commit)")

            return SaveFileResponse(
                success=True,
                message=f"{'Created' if is_new else 'Updated'} {request.file_path}",
                file_path=request.file_path,
                commit_sha=commit_sha,
                timestamp=datetime.utcnow()
            )

        except Exception as e:
            logger.error(f"Save file failed: {e}")
            return SaveFileResponse(
                success=False,
                message=f"Save failed: {str(e)}",
                file_path=request.file_path
            )

    def read_file(self, project_id: str, file_path: str, commit_sha: Optional[str] = None) -> Tuple[bool, str, str]:
        """
        Read a file's content, optionally from a specific commit.

        Returns:
            Tuple of (success, content, error_message)
        """
        try:
            project_path = self._get_project_path(project_id)

            if commit_sha:
                # Read from specific commit
                repo = self._get_repo(project_id)
                commit = repo.commit(commit_sha)
                blob = commit.tree / file_path
                content = blob.data_stream.read().decode('utf-8')
            else:
                # Read current version
                file_full_path = project_path / file_path
                if not file_full_path.exists():
                    return False, "", f"File not found: {file_path}"
                content = file_full_path.read_text()

            return True, content, ""

        except Exception as e:
            return False, "", str(e)

    # ============================================
    # List/Browse Operations
    # ============================================

    def list_files(self, request: ListFilesRequest) -> ListFilesResponse:
        """List tracked files in a project."""
        try:
            repo = self._get_repo(request.project_id)
            project_path = self._get_project_path(request.project_id)

            files = []

            # Get all tracked files
            for item in repo.head.commit.tree.traverse():
                if item.type != 'blob':
                    continue

                file_path = item.path

                # Apply directory filter
                if request.directory and not file_path.startswith(request.directory):
                    continue

                # Get category
                category = self._get_file_category(file_path)

                # Apply category filter
                if request.category and category != request.category:
                    continue

                # Get file info
                full_path = project_path / file_path
                size_bytes = full_path.stat().st_size if full_path.exists() else 0

                # Get last commit for this file
                last_commit = next(repo.iter_commits(paths=file_path, max_count=1), None)

                files.append(FileInfo(
                    path=file_path,
                    category=category,
                    size_bytes=size_bytes,
                    last_modified=datetime.fromtimestamp(last_commit.committed_date) if last_commit else datetime.utcnow(),
                    last_commit_sha=last_commit.hexsha if last_commit else "",
                    last_commit_message=last_commit.message.split('\n')[0] if last_commit else ""
                ))

            return ListFilesResponse(
                success=True,
                project_id=request.project_id,
                files=files,
                total_count=len(files)
            )

        except Exception as e:
            logger.error(f"List files failed: {e}")
            return ListFilesResponse(
                success=False,
                project_id=request.project_id
            )


# Create singleton instance
version_control_service = VersionControlService()
