"""
Prompt Manager - Load and manage extraction prompts by tier and version.

This module provides centralized prompt management for clinical data extraction:
- Tier-specific prompts (NANO, MINI, FRONTIER)
- Version tracking (v1, v2)
- Template variable substitution
- Prompt token estimation for cost optimization

Usage:
    from data_extraction.prompt_manager import PromptManager
    
    pm = PromptManager()
    prompt = pm.get_extraction_prompt(tier="FRONTIER", input_text="Patient had surgery...")
    
    # Get prompt metadata
    info = pm.get_prompt_info("clinical_note_extract", tier="MINI")
"""

import os
import re
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, List, Any
from functools import lru_cache

logger = logging.getLogger(__name__)

# Prompts directory
PROMPTS_DIR = Path(__file__).parent / "prompts"

# Token estimation (rough approximation: 1 token ≈ 4 characters for English)
CHARS_PER_TOKEN = 4


@dataclass
class PromptInfo:
    """Metadata about a prompt template."""
    name: str
    tier: str
    version: str
    path: Path
    char_count: int
    estimated_tokens: int
    variables: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "tier": self.tier,
            "version": self.version,
            "path": str(self.path),
            "char_count": self.char_count,
            "estimated_tokens": self.estimated_tokens,
            "variables": self.variables,
        }


class PromptError(Exception):
    """Exception for prompt loading errors."""
    pass


class PromptManager:
    """
    Manage extraction prompts with tier-specific loading and version control.
    
    Tier Hierarchy:
    - NANO: Minimal prompt for small/fast models (GPT-3.5, Claude Haiku)
    - MINI: Standard prompt for mid-tier models (GPT-4o-mini, Claude Sonnet)
    - FRONTIER: Comprehensive prompt for large models (GPT-4, Claude Opus)
    
    If a tier-specific prompt doesn't exist, falls back to v2 then v1.
    """
    
    # Prompt file naming conventions
    PROMPT_FILES = {
        "extraction": {
            "NANO": "clinical_note_extract_nano.txt",
            "MINI": "clinical_note_extract_v2.txt",
            "FRONTIER": "clinical_note_extract_frontier.txt",
            "default": "clinical_note_extract_v2.txt",
            "v1": "clinical_note_extract_v1.txt",
        },
        "repair": {
            "default": "clinical_note_repair_json_v2.txt",
            "v1": "clinical_note_repair_json_v1.txt",
        },
        "classify": {
            "default": "note_type_classify_v1.txt",
        },
    }
    
    # Default tier for each use case
    DEFAULT_TIERS = {
        "extraction": "MINI",
        "repair": "default",
        "classify": "default",
    }
    
    def __init__(self, prompts_dir: Optional[Path] = None):
        """
        Initialize prompt manager.
        
        Args:
            prompts_dir: Custom prompts directory (uses default if None)
        """
        self.prompts_dir = prompts_dir or PROMPTS_DIR
        self._cache: Dict[str, str] = {}
        self._info_cache: Dict[str, PromptInfo] = {}
    
    def _get_prompt_path(self, prompt_type: str, tier: Optional[str] = None) -> Path:
        """
        Get the path to a prompt file with tier fallback.
        
        Args:
            prompt_type: Type of prompt (extraction, repair, classify)
            tier: Model tier (NANO, MINI, FRONTIER) or None for default
        
        Returns:
            Path to the prompt file
        
        Raises:
            PromptError: If no valid prompt file found
        """
        if prompt_type not in self.PROMPT_FILES:
            raise PromptError(f"Unknown prompt type: {prompt_type}")
        
        files = self.PROMPT_FILES[prompt_type]
        tier = tier or self.DEFAULT_TIERS.get(prompt_type, "default")
        
        # Try tier-specific file first
        if tier in files:
            path = self.prompts_dir / files[tier]
            if path.exists():
                return path
        
        # Fall back to default
        if "default" in files:
            path = self.prompts_dir / files["default"]
            if path.exists():
                return path
        
        # Fall back to v1
        if "v1" in files:
            path = self.prompts_dir / files["v1"]
            if path.exists():
                return path
        
        raise PromptError(f"No prompt file found for {prompt_type} tier={tier}")
    
    @lru_cache(maxsize=32)
    def _load_prompt(self, path: str) -> str:
        """Load and cache a prompt file."""
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            raise PromptError(f"Prompt file not found: {path}")
        except Exception as e:
            raise PromptError(f"Failed to load prompt {path}: {e}")
    
    def _extract_variables(self, template: str) -> List[str]:
        """Extract variable names from a prompt template."""
        # Match {variable_name} patterns
        pattern = r'\{(\w+)\}'
        return list(set(re.findall(pattern, template)))
    
    def _estimate_tokens(self, text: str) -> int:
        """Estimate token count for text."""
        return len(text) // CHARS_PER_TOKEN
    
    def get_prompt(
        self,
        prompt_type: str,
        tier: Optional[str] = None,
        **variables,
    ) -> str:
        """
        Get a prompt with variables substituted.
        
        Args:
            prompt_type: Type of prompt (extraction, repair, classify)
            tier: Model tier (NANO, MINI, FRONTIER)
            **variables: Variables to substitute in the template
        
        Returns:
            Rendered prompt string
        """
        path = self._get_prompt_path(prompt_type, tier)
        template = self._load_prompt(str(path))
        
        # Use simple string replacement instead of .format() to avoid
        # issues with JSON braces in prompts
        result = template
        for key, value in variables.items():
            placeholder = "{" + key + "}"
            result = result.replace(placeholder, str(value))
        
        return result
    
    def get_extraction_prompt(
        self,
        input_text: str,
        tier: Optional[str] = None,
    ) -> str:
        """
        Get clinical extraction prompt with input text.
        
        Args:
            input_text: Clinical text to extract from
            tier: Model tier (NANO, MINI, FRONTIER)
        
        Returns:
            Complete prompt ready for LLM
        """
        return self.get_prompt("extraction", tier=tier, input_text=input_text)
    
    def get_repair_prompt(
        self,
        malformed_json: str,
    ) -> str:
        """
        Get JSON repair prompt.
        
        Args:
            malformed_json: Malformed JSON string to repair
        
        Returns:
            Complete repair prompt
        """
        return self.get_prompt("repair", malformed_json=malformed_json)
    
    def get_classify_prompt(
        self,
        input_text: str,
    ) -> str:
        """
        Get note type classification prompt.
        
        Args:
            input_text: Clinical text to classify
        
        Returns:
            Complete classification prompt
        """
        return self.get_prompt("classify", input_text=input_text)
    
    def get_prompt_info(
        self,
        prompt_type: str,
        tier: Optional[str] = None,
    ) -> PromptInfo:
        """
        Get metadata about a prompt template.
        
        Args:
            prompt_type: Type of prompt
            tier: Model tier
        
        Returns:
            PromptInfo with metadata
        """
        path = self._get_prompt_path(prompt_type, tier)
        cache_key = f"{prompt_type}:{tier}:{path}"
        
        if cache_key not in self._info_cache:
            template = self._load_prompt(str(path))
            
            # Determine version from filename
            filename = path.name
            if "frontier" in filename:
                version = "2.0-frontier"
            elif "nano" in filename:
                version = "2.0-nano"
            elif "v2" in filename:
                version = "2.0"
            else:
                version = "1.0"
            
            self._info_cache[cache_key] = PromptInfo(
                name=prompt_type,
                tier=tier or self.DEFAULT_TIERS.get(prompt_type, "default"),
                version=version,
                path=path,
                char_count=len(template),
                estimated_tokens=self._estimate_tokens(template),
                variables=self._extract_variables(template),
            )
        
        return self._info_cache[cache_key]
    
    def estimate_request_tokens(
        self,
        prompt_type: str,
        input_text: str,
        tier: Optional[str] = None,
    ) -> Dict[str, int]:
        """
        Estimate total request tokens including input.
        
        Args:
            prompt_type: Type of prompt
            input_text: Input text to be included
            tier: Model tier
        
        Returns:
            Dictionary with token estimates
        """
        info = self.get_prompt_info(prompt_type, tier)
        input_tokens = self._estimate_tokens(input_text)
        
        return {
            "prompt_base_tokens": info.estimated_tokens,
            "input_tokens": input_tokens,
            "total_request_tokens": info.estimated_tokens + input_tokens,
            "tier": info.tier,
            "version": info.version,
        }
    
    def get_optimal_tier(
        self,
        input_text: str,
        max_tokens: int = 4000,
        prefer_quality: bool = False,
    ) -> str:
        """
        Recommend optimal tier based on input length.
        
        Args:
            input_text: Clinical text to process
            max_tokens: Maximum context tokens
            prefer_quality: Prefer higher quality over speed/cost
        
        Returns:
            Recommended tier (NANO, MINI, FRONTIER)
        """
        input_tokens = self._estimate_tokens(input_text)
        
        # Get base prompt sizes
        nano_base = self.get_prompt_info("extraction", "NANO").estimated_tokens
        mini_base = self.get_prompt_info("extraction", "MINI").estimated_tokens
        frontier_base = self.get_prompt_info("extraction", "FRONTIER").estimated_tokens
        
        # Check what fits
        if input_tokens + frontier_base <= max_tokens and prefer_quality:
            return "FRONTIER"
        
        if input_tokens + mini_base <= max_tokens:
            return "MINI"
        
        if input_tokens + nano_base <= max_tokens:
            return "NANO"
        
        # Text too long - use NANO and truncate
        logger.warning(f"Input ({input_tokens} tokens) too long, using NANO tier")
        return "NANO"
    
    def list_prompts(self) -> List[Dict[str, Any]]:
        """
        List all available prompts with metadata.
        
        Returns:
            List of prompt information dictionaries
        """
        prompts = []
        for prompt_type in self.PROMPT_FILES:
            for tier_or_version, filename in self.PROMPT_FILES[prompt_type].items():
                path = self.prompts_dir / filename
                if path.exists():
                    try:
                        info = self.get_prompt_info(prompt_type, tier_or_version)
                        prompts.append(info.to_dict())
                    except Exception as e:
                        logger.warning(f"Failed to load info for {filename}: {e}")
        
        return prompts


# Module-level singleton
_default_manager: Optional[PromptManager] = None


def get_prompt_manager() -> PromptManager:
    """Get or create the default prompt manager singleton."""
    global _default_manager
    if _default_manager is None:
        _default_manager = PromptManager()
    return _default_manager


def get_extraction_prompt(input_text: str, tier: Optional[str] = None) -> str:
    """Convenience function for extraction prompts."""
    return get_prompt_manager().get_extraction_prompt(input_text, tier)


def get_repair_prompt(malformed_json: str) -> str:
    """Convenience function for repair prompts."""
    return get_prompt_manager().get_repair_prompt(malformed_json)


def get_classify_prompt(input_text: str) -> str:
    """Convenience function for classification prompts."""
    return get_prompt_manager().get_classify_prompt(input_text)


def estimate_tokens(input_text: str, tier: Optional[str] = None) -> Dict[str, int]:
    """Convenience function for token estimation."""
    return get_prompt_manager().estimate_request_tokens("extraction", input_text, tier)


def get_optimal_tier(input_text: str, prefer_quality: bool = False) -> str:
    """Convenience function for tier recommendation."""
    return get_prompt_manager().get_optimal_tier(input_text, prefer_quality=prefer_quality)


# Exports
__all__ = [
    "PromptManager",
    "PromptInfo",
    "PromptError",
    "get_prompt_manager",
    "get_extraction_prompt",
    "get_repair_prompt",
    "get_classify_prompt",
    "estimate_tokens",
    "get_optimal_tier",
]
