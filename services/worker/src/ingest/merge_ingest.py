"""
Multi-File Merge Ingestion Engine

Handles ingestion and merging of multiple files/sheets with:
- Two-phase workflow (detect + confirm + merge)
- Automatic ID column detection using fuzzy matching
- Support for CSV, TSV, Excel (xlsx/xls), Parquet
- Large file handling via Dask chunking
- Audit manifests for provenance tracking
- PHI governance mode awareness

Part of the multi-file ingestion feature.
"""
import os
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Union, Any, Tuple
from dataclasses import dataclass, field, asdict
import pandas as pd

logger = logging.getLogger(__name__)

# Optional imports with availability flags
try:
    import dask.dataframe as dd
    DASK_AVAILABLE = True
except ImportError:
    DASK_AVAILABLE = False
    logger.info("dask not available - large file chunking disabled")

try:
    import polars as pl
    POLARS_AVAILABLE = True
except ImportError:
    POLARS_AVAILABLE = False
    logger.info("polars not available - high-performance mode disabled")

try:
    import duckdb
    DUCKDB_AVAILABLE = True
except ImportError:
    DUCKDB_AVAILABLE = False
    logger.info("duckdb not available - persistent storage disabled")

try:
    import pandera as pa
    PANDERA_AVAILABLE = True
except ImportError:
    PANDERA_AVAILABLE = False
    logger.info("pandera not available - schema validation disabled")

# Import ID detection utilities
try:
    from utils.id_detection import (
        detect_id_candidates,
        find_matching_column,
        validate_id_column,
        format_confirmation_prompt,
        IDCandidate,
    )
except ImportError:
    # Fallback for relative import in package context
    from ..utils.id_detection import (
        detect_id_candidates,
        find_matching_column,
        validate_id_column,
        format_confirmation_prompt,
        IDCandidate,
    )


@dataclass
class MergeManifest:
    """Audit manifest for merge operations."""
    run_id: str
    started_at: str
    completed_at: Optional[str] = None
    governance_mode: str = "DEMO"
    source_directory: Optional[str] = None
    source_files: List[str] = field(default_factory=list)
    rows_before_merge: Dict[str, int] = field(default_factory=dict)
    rows_after_merge: Optional[int] = None
    columns_by_source: Dict[str, List[str]] = field(default_factory=dict)
    columns_merged: List[str] = field(default_factory=list)
    id_column: Optional[str] = None
    id_column_aliases: Dict[str, str] = field(default_factory=dict)
    merge_strategy: Optional[str] = None
    user_confirmation: Optional[str] = None
    id_candidates: List[Dict[str, Any]] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def save(self, path: str) -> None:
        """Save manifest to JSON file."""
        with open(path, 'w') as f:
            json.dump(self.to_dict(), f, indent=2)

    @classmethod
    def load(cls, path: str) -> 'MergeManifest':
        """Load manifest from JSON file."""
        with open(path, 'r') as f:
            data = json.load(f)
        return cls(**data)


@dataclass
class MergeResult:
    """Result of a merge operation."""
    success: bool
    dataframe: Optional[pd.DataFrame]
    manifest: MergeManifest
    needs_confirmation: bool = False
    confirmation_prompt: Optional[str] = None
    candidates: List[IDCandidate] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'success': self.success,
            'needs_confirmation': self.needs_confirmation,
            'confirmation_prompt': self.confirmation_prompt,
            'manifest': self.manifest.to_dict(),
            'candidates': [c.to_dict() for c in self.candidates],
            'row_count': len(self.dataframe) if self.dataframe is not None else 0,
            'column_count': len(self.dataframe.columns) if self.dataframe is not None else 0,
        }


class MultiFileIngestEngine:
    """
    Multi-file ingestion engine with ID detection and merge capabilities.

    Supports a two-phase workflow:
    1. Phase 1: Ingest files and detect ID candidates
    2. Phase 2: After user confirmation, complete the merge

    Features:
    - Automatic ID column detection using fuzzy matching
    - Support for CSV, TSV, Excel (xlsx/xls), Parquet
    - Large file handling via Dask chunking
    - Optional DuckDB persistence for provenance
    - PHI governance mode awareness
    """

    def __init__(
        self,
        governance_mode: str = "DEMO",
        artifacts_dir: Optional[str] = None,
        chunk_size: str = "50MB",
        fuzzy_threshold: int = 85,
        use_dask: bool = True,
        use_polars: bool = False,
        use_duckdb: bool = False,
    ):
        """
        Initialize the multi-file ingest engine.

        Args:
            governance_mode: "DEMO" or "LIVE" - affects PHI handling
            artifacts_dir: Directory to store merge manifests
            chunk_size: Dask chunk size for large files
            fuzzy_threshold: Threshold for fuzzy column name matching (0-100)
            use_dask: Enable Dask for large file processing
            use_polars: Enable Polars for high-performance operations
            use_duckdb: Enable DuckDB for persistent storage
        """
        self.governance_mode = governance_mode
        self.chunk_size = chunk_size
        self.fuzzy_threshold = fuzzy_threshold
        self.use_dask = use_dask and DASK_AVAILABLE
        self.use_polars = use_polars and POLARS_AVAILABLE
        self.use_duckdb = use_duckdb and DUCKDB_AVAILABLE

        # Setup artifacts directory
        if artifacts_dir:
            self.artifacts_dir = Path(artifacts_dir)
        else:
            self.artifacts_dir = Path(os.environ.get(
                'RESEARCHFLOW_ARTIFACTS_DIR',
                '/tmp/researchflow/artifacts'
            ))
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)

        logger.info(
            f"MultiFileIngestEngine initialized: "
            f"governance={governance_mode}, dask={self.use_dask}, "
            f"polars={self.use_polars}, duckdb={self.use_duckdb}"
        )

    def read_directory(
        self,
        directory: Union[str, Path],
        file_pattern: str = "*.csv,*.xlsx"
    ) -> Dict[str, pd.DataFrame]:
        """
        Read all matching files from a directory.

        Args:
            directory: Directory path
            file_pattern: Comma-separated glob patterns

        Returns:
            Dict mapping filename to DataFrame
        """
        directory = Path(directory)
        if not directory.exists():
            raise FileNotFoundError(f"Directory not found: {directory}")

        dataframes = {}
        patterns = [p.strip() for p in file_pattern.split(',')]

        for pattern in patterns:
            for file_path in directory.glob(pattern):
                try:
                    df = self._read_single_file(file_path)
                    dataframes[file_path.name] = df
                    logger.info(f"Read {file_path.name}: {len(df)} rows, {len(df.columns)} columns")
                except Exception as e:
                    logger.error(f"Failed to read {file_path.name}: {e}")

        return dataframes

    def read_multi_sheet_workbook(
        self,
        file_path: Union[str, Path],
        sheets: Optional[List[str]] = None
    ) -> Dict[str, pd.DataFrame]:
        """
        Read multiple sheets from an Excel workbook.

        Args:
            file_path: Path to Excel file
            sheets: List of sheet names to read (None = all sheets)

        Returns:
            Dict mapping "filename_sheetname" to DataFrame
        """
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        try:
            xl = pd.ExcelFile(file_path)
        except Exception as e:
            raise ValueError(f"Failed to open Excel file {file_path}: {e}")

        sheet_names = sheets if sheets else xl.sheet_names
        dataframes = {}

        for sheet in sheet_names:
            try:
                df = pd.read_excel(xl, sheet_name=sheet)
                key = f"{file_path.stem}_{sheet}"
                dataframes[key] = df
                logger.info(f"Read sheet '{sheet}': {len(df)} rows, {len(df.columns)} columns")
            except Exception as e:
                logger.error(f"Failed to read sheet '{sheet}': {e}")

        return dataframes

    def _read_single_file(self, file_path: Path) -> pd.DataFrame:
        """
        Read a single file based on extension.

        Args:
            file_path: Path to file

        Returns:
            DataFrame with file contents
        """
        suffix = file_path.suffix.lower()

        if suffix == '.csv':
            if self.use_dask:
                ddf = dd.read_csv(file_path, blocksize=self.chunk_size)
                return ddf.compute()
            return pd.read_csv(file_path)

        elif suffix == '.tsv':
            if self.use_dask:
                ddf = dd.read_csv(file_path, sep='\t', blocksize=self.chunk_size)
                return ddf.compute()
            return pd.read_csv(file_path, sep='\t')

        elif suffix in ['.xlsx', '.xls']:
            return pd.read_excel(file_path)

        elif suffix == '.parquet':
            if self.use_polars:
                return pl.read_parquet(file_path).to_pandas()
            return pd.read_parquet(file_path)

        else:
            raise ValueError(f"Unsupported file type: {suffix}")

    def ingest_and_detect(
        self,
        source: Union[str, Path],
        file_pattern: str = "*.csv,*.xlsx",
        run_id: Optional[str] = None,
    ) -> MergeResult:
        """
        Ingest files and detect ID candidates (Phase 1).

        This is the first phase of the two-phase workflow. It reads all
        files from the source and detects candidate ID columns.

        Args:
            source: Directory path or single Excel file path
            file_pattern: Glob pattern for files (e.g., "*.csv,*.xlsx")
            run_id: Unique identifier for this run (auto-generated if not provided)

        Returns:
            MergeResult with needs_confirmation=True if candidates found
        """
        run_id = run_id or datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")

        manifest = MergeManifest(
            run_id=run_id,
            started_at=datetime.utcnow().isoformat(),
            governance_mode=self.governance_mode,
        )

        try:
            source = Path(source)
            manifest.source_directory = str(source)

            # Read files based on source type
            if source.is_dir():
                dataframes = self.read_directory(source, file_pattern)
            elif source.suffix.lower() in ['.xlsx', '.xls']:
                dataframes = self.read_multi_sheet_workbook(source)
            else:
                # Single file
                dataframes = {source.name: self._read_single_file(source)}

            if not dataframes:
                manifest.errors.append("No data files found")
                return MergeResult(
                    success=False,
                    dataframe=None,
                    manifest=manifest,
                    needs_confirmation=False,
                )

            # Record source files and row counts
            manifest.source_files = list(dataframes.keys())
            manifest.rows_before_merge = {k: len(v) for k, v in dataframes.items()}
            manifest.columns_by_source = {k: list(v.columns) for k, v in dataframes.items()}

            # If single DataFrame, no merge needed
            if len(dataframes) == 1:
                df = list(dataframes.values())[0]
                manifest.completed_at = datetime.utcnow().isoformat()
                manifest.rows_after_merge = len(df)
                manifest.columns_merged = list(df.columns)

                return MergeResult(
                    success=True,
                    dataframe=df,
                    manifest=manifest,
                    needs_confirmation=False,
                )

            # Detect ID candidates
            logger.info(f"Detecting ID candidates across {len(dataframes)} files...")
            candidates = detect_id_candidates(
                dataframes,
                fuzzy_threshold=self.fuzzy_threshold,
            )
            manifest.id_candidates = [c.to_dict() for c in candidates]

            if not candidates:
                manifest.warnings.append("No suitable ID columns detected for merge")
                return MergeResult(
                    success=False,
                    dataframe=None,
                    manifest=manifest,
                    needs_confirmation=True,
                    confirmation_prompt=(
                        "No candidate ID columns detected automatically. "
                        "Please specify the linking column name manually."
                    ),
                    candidates=[],
                )

            # Format confirmation prompt
            prompt = format_confirmation_prompt(candidates)
            logger.info(f"Detected {len(candidates)} candidates. Top: {candidates[0].column_name}")

            return MergeResult(
                success=False,  # Not complete yet - needs confirmation
                dataframe=None,
                manifest=manifest,
                needs_confirmation=True,
                confirmation_prompt=prompt,
                candidates=candidates,
            )

        except Exception as e:
            logger.error(f"Ingest failed: {e}")
            manifest.errors.append(str(e))
            return MergeResult(
                success=False,
                dataframe=None,
                manifest=manifest,
            )

    def complete_merge(
        self,
        source: Union[str, Path],
        id_column: str,
        user_response: str,
        manifest: MergeManifest,
        file_pattern: str = "*.csv,*.xlsx",
        merge_strategy: str = "outer",
    ) -> MergeResult:
        """
        Complete merge operation after user confirmation (Phase 2).

        This is the second phase of the two-phase workflow. After the user
        confirms the ID column, this method performs the actual merge.

        Args:
            source: Directory path or single Excel file path
            id_column: Confirmed ID column to merge on
            user_response: User's confirmation response ('yes', 'no', or column name)
            manifest: Manifest from Phase 1
            file_pattern: Glob pattern for files
            merge_strategy: Merge strategy ('outer', 'inner', 'left', 'right')

        Returns:
            MergeResult with merged DataFrame if successful
        """
        manifest.user_confirmation = user_response
        manifest.id_column = id_column
        manifest.merge_strategy = merge_strategy

        try:
            source = Path(source)

            # Re-read files
            if source.is_dir():
                dataframes = self.read_directory(source, file_pattern)
            elif source.suffix.lower() in ['.xlsx', '.xls']:
                dataframes = self.read_multi_sheet_workbook(source)
            else:
                dataframes = {source.name: self._read_single_file(source)}

            # Validate ID column exists in all files
            is_valid, error = validate_id_column(
                dataframes, id_column, self.fuzzy_threshold
            )
            if not is_valid:
                manifest.errors.append(error)
                return MergeResult(
                    success=False,
                    dataframe=None,
                    manifest=manifest,
                )

            # Record ID column aliases (actual column name in each file)
            for filename, df in dataframes.items():
                match = find_matching_column(df.columns.tolist(), id_column, self.fuzzy_threshold)
                if match:
                    manifest.id_column_aliases[filename] = match

            # Perform merge
            logger.info(f"Merging {len(dataframes)} files on '{id_column}' using {merge_strategy} join")
            merged_df = self._merge_dataframes(dataframes, id_column, merge_strategy)

            # Update manifest
            manifest.completed_at = datetime.utcnow().isoformat()
            manifest.rows_after_merge = len(merged_df)
            manifest.columns_merged = list(merged_df.columns)

            # Validate merged DataFrame
            if PANDERA_AVAILABLE:
                validation_errors = self._validate_merged_df(merged_df, id_column)
                if validation_errors:
                    manifest.warnings.extend(validation_errors)

            # Save manifest
            manifest_path = self.artifacts_dir / f"merge_manifest_{manifest.run_id}.json"
            manifest.save(str(manifest_path))

            # Optionally store in DuckDB
            if self.use_duckdb:
                self._store_in_duckdb(merged_df, manifest)

            logger.info(f"Merge complete: {len(merged_df)} rows, {len(merged_df.columns)} columns")

            return MergeResult(
                success=True,
                dataframe=merged_df,
                manifest=manifest,
            )

        except Exception as e:
            logger.error(f"Merge failed: {e}")
            manifest.errors.append(str(e))
            return MergeResult(
                success=False,
                dataframe=None,
                manifest=manifest,
            )

    def _merge_dataframes(
        self,
        dataframes: Dict[str, pd.DataFrame],
        id_column: str,
        strategy: str = "outer",
    ) -> pd.DataFrame:
        """
        Merge multiple DataFrames on the specified ID column.

        Args:
            dataframes: Dict mapping filename to DataFrame
            id_column: Column to merge on
            strategy: Merge strategy

        Returns:
            Merged DataFrame
        """
        df_list = list(dataframes.items())

        # Start with first DataFrame
        result_name, result = df_list[0]

        # Normalize ID column name in result
        id_col_match = find_matching_column(result.columns.tolist(), id_column, self.fuzzy_threshold)
        if id_col_match and id_col_match != id_column:
            result = result.rename(columns={id_col_match: id_column})

        # Add source column for provenance
        result['_source'] = result_name

        # Merge remaining DataFrames
        for filename, df in df_list[1:]:
            # Normalize ID column name
            id_col_match = find_matching_column(df.columns.tolist(), id_column, self.fuzzy_threshold)
            if id_col_match and id_col_match != id_column:
                df = df.rename(columns={id_col_match: id_column})

            # Add source column
            df['_source'] = filename

            # Handle duplicate column names (except ID column)
            for col in df.columns:
                if col != id_column and col != '_source' and col in result.columns:
                    df = df.rename(columns={col: f"{col}_{filename}"})

            # Merge
            result = pd.merge(
                result,
                df,
                on=id_column,
                how=strategy,
                suffixes=('', f'_{filename}')
            )

        return result

    def _validate_merged_df(
        self,
        df: pd.DataFrame,
        id_column: str
    ) -> List[str]:
        """
        Validate merged DataFrame using Pandera.

        Args:
            df: Merged DataFrame
            id_column: ID column name

        Returns:
            List of validation warning messages
        """
        warnings = []

        try:
            # Check for duplicate IDs
            if df[id_column].duplicated().any():
                dup_count = df[id_column].duplicated().sum()
                warnings.append(f"Found {dup_count} duplicate ID values after merge")

            # Check for null IDs
            null_count = df[id_column].isna().sum()
            if null_count > 0:
                warnings.append(f"Found {null_count} null ID values after merge")

        except Exception as e:
            warnings.append(f"Validation error: {e}")

        return warnings

    def _store_in_duckdb(
        self,
        df: pd.DataFrame,
        manifest: MergeManifest
    ) -> None:
        """
        Store merged DataFrame and manifest in DuckDB.

        Args:
            df: Merged DataFrame
            manifest: Merge manifest
        """
        if not DUCKDB_AVAILABLE:
            return

        try:
            db_path = self.artifacts_dir / "merge_provenance.duckdb"
            conn = duckdb.connect(str(db_path))

            # Store merged data
            table_name = f"merge_{manifest.run_id}"
            conn.execute(f"CREATE TABLE IF NOT EXISTS {table_name} AS SELECT * FROM df")

            # Store manifest
            conn.execute("""
                CREATE TABLE IF NOT EXISTS merge_manifests (
                    run_id VARCHAR PRIMARY KEY,
                    manifest JSON,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute(
                "INSERT OR REPLACE INTO merge_manifests (run_id, manifest) VALUES (?, ?)",
                [manifest.run_id, json.dumps(manifest.to_dict())]
            )

            conn.close()
            logger.info(f"Stored merge result in DuckDB: {table_name}")

        except Exception as e:
            logger.error(f"Failed to store in DuckDB: {e}")
