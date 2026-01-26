"""
Data Extraction Configuration Module.

This module provides configuration management for the cell-level block text
parsing and large sheet processing pipeline. Supports YAML-based configuration
with runtime overrides.

Architecture:
- Config loaded from YAML at startup
- Environment variables can override YAML values
- Runtime config can be passed per-job
"""

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, List, Dict, Any, Literal
import yaml
import logging

logger = logging.getLogger(__name__)

# Default paths
CONFIG_DIR = Path(__file__).parent
DEFAULT_CONFIG_PATH = CONFIG_DIR / "config.yaml"


@dataclass
class BlockTextConfig:
    """Configuration for block text detection heuristics."""
    min_chars: int = 120
    min_newlines: int = 2
    min_alpha_ratio: float = 0.40
    clinical_heading_regex: str = r"(?i)\b(HPI|ROS|PMH|PSH|A/P|Assessment|Plan|PE|Vitals|Labs|Impression)\b"
    clinical_marker_tokens: List[str] = field(default_factory=lambda: [
        "HPI", "ROS", "PMH", "PSH", "A/P", "Assessment", "Plan", "PE", 
        "Vitals", "Labs", "Impression", "denies", "reports", "complains of",
        "post-op", "POD", "ECOG", "ASA", "HbA1c", "WBC"
    ])
    min_clinical_markers: int = 1
    deny_columns: List[str] = field(default_factory=lambda: [
        "mrn", "patient_id", "dob", "ssn", "id", "row_id", "index"
    ])
    allow_columns: List[str] = field(default_factory=lambda: [
        "ros", "clinical_notes", "op_note", "discharge_summary",
        "hpi", "assessment_plan", "history", "physical_exam", "notes"
    ])


@dataclass
class LargeSheetConfig:
    """Configuration for large sheet processing pipeline."""
    large_csv_mb: int = 200
    chunk_rows: int = 50_000
    llm_concurrency: int = 24
    llm_batch_size: int = 20
    task_checkpoint_every_chunks: int = 1
    output_format: Literal["parquet", "jsonl"] = "parquet"
    join_back_to_sheet: bool = False
    enable_dask: bool = False
    dask_blocksize: str = "64MB"


@dataclass 
class PromptPackConfig:
    """Configuration for prompt template selection."""
    cell_extract: str = "clinical_note_extract_v2"
    ros_extract: str = "ros_extract_v1"
    outcome_extract: str = "outcome_extract_v1"
    note_classify: str = "note_type_classify_v1"
    json_repair: str = "clinical_note_repair_json_v2"


@dataclass
class ExtractionConfig:
    """Main configuration container for data extraction."""
    block_text: BlockTextConfig = field(default_factory=BlockTextConfig)
    large_sheet: LargeSheetConfig = field(default_factory=LargeSheetConfig)
    prompt_pack: PromptPackConfig = field(default_factory=PromptPackConfig)
    
    # Runtime settings
    ai_router_url: str = ""
    orchestrator_url: str = ""
    extraction_timeout_seconds: int = 60
    enrichment_timeout_seconds: int = 30
    enable_phi_scanning: bool = True
    block_on_phi: bool = True
    enable_nlm_enrichment: bool = False
    
    def __post_init__(self):
        """Load from environment variables."""
        self.ai_router_url = os.getenv(
            "AI_ROUTER_URL", 
            "http://localhost:3001/api/ai/extraction/generate"
        )
        self.orchestrator_url = os.getenv(
            "ORCHESTRATOR_URL",
            "http://localhost:3001"
        )
        self.extraction_timeout_seconds = int(os.getenv(
            "EXTRACTION_TIMEOUT_SECONDS", 
            "60"
        ))
        self.enrichment_timeout_seconds = int(os.getenv(
            "ENRICHMENT_TIMEOUT_SECONDS",
            "30"
        ))


def load_config(config_path: Optional[Path] = None) -> ExtractionConfig:
    """
    Load extraction configuration from YAML file.
    
    Args:
        config_path: Path to YAML config file. Uses default if None.
        
    Returns:
        ExtractionConfig instance
    """
    path = config_path or DEFAULT_CONFIG_PATH
    config = ExtractionConfig()
    
    if path.exists():
        try:
            with open(path) as f:
                yaml_config = yaml.safe_load(f) or {}
            
            # Apply block_text config
            if "block_text" in yaml_config:
                for key, value in yaml_config["block_text"].items():
                    if hasattr(config.block_text, key):
                        setattr(config.block_text, key, value)
            
            # Apply large_sheet config
            if "large_sheet" in yaml_config:
                for key, value in yaml_config["large_sheet"].items():
                    if hasattr(config.large_sheet, key):
                        setattr(config.large_sheet, key, value)
            
            # Apply prompt_pack config
            if "prompt_pack" in yaml_config:
                for key, value in yaml_config["prompt_pack"].items():
                    if hasattr(config.prompt_pack, key):
                        setattr(config.prompt_pack, key, value)
            
            logger.info(f"Loaded config from {path}")
            
        except Exception as e:
            logger.warning(f"Failed to load config from {path}: {e}, using defaults")
    else:
        logger.info(f"Config file not found at {path}, using defaults")
    
    return config


def config_to_dict(config: ExtractionConfig) -> Dict[str, Any]:
    """Convert config to dictionary for serialization."""
    return {
        "block_text": {
            "min_chars": config.block_text.min_chars,
            "min_newlines": config.block_text.min_newlines,
            "min_alpha_ratio": config.block_text.min_alpha_ratio,
            "clinical_heading_regex": config.block_text.clinical_heading_regex,
            "min_clinical_markers": config.block_text.min_clinical_markers,
            "deny_columns": config.block_text.deny_columns,
            "allow_columns": config.block_text.allow_columns,
        },
        "large_sheet": {
            "large_csv_mb": config.large_sheet.large_csv_mb,
            "chunk_rows": config.large_sheet.chunk_rows,
            "llm_concurrency": config.large_sheet.llm_concurrency,
            "llm_batch_size": config.large_sheet.llm_batch_size,
            "output_format": config.large_sheet.output_format,
            "join_back_to_sheet": config.large_sheet.join_back_to_sheet,
            "enable_dask": config.large_sheet.enable_dask,
        },
        "prompt_pack": {
            "cell_extract": config.prompt_pack.cell_extract,
            "ros_extract": config.prompt_pack.ros_extract,
            "outcome_extract": config.prompt_pack.outcome_extract,
        },
        "runtime": {
            "ai_router_url": config.ai_router_url,
            "orchestrator_url": config.orchestrator_url,
            "extraction_timeout_seconds": config.extraction_timeout_seconds,
            "enable_phi_scanning": config.enable_phi_scanning,
            "enable_nlm_enrichment": config.enable_nlm_enrichment,
        }
    }


# Global config instance (lazy loaded)
_config: Optional[ExtractionConfig] = None


def get_config() -> ExtractionConfig:
    """Get the global config instance, loading if necessary."""
    global _config
    if _config is None:
        _config = load_config()
    return _config


def reset_config():
    """Reset the global config (useful for testing)."""
    global _config
    _config = None


__all__ = [
    "BlockTextConfig",
    "LargeSheetConfig", 
    "PromptPackConfig",
    "ExtractionConfig",
    "load_config",
    "config_to_dict",
    "get_config",
    "reset_config",
]
