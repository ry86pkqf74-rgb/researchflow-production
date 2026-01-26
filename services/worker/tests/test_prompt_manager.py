"""
Tests for the prompt_manager module.

Tests prompt loading, tier selection, token estimation, and variable substitution.
"""

import pytest
from pathlib import Path
import sys

sys.path.insert(0, '../src')

from data_extraction.prompt_manager import (
    PromptManager,
    PromptInfo,
    PromptError,
    get_prompt_manager,
    get_extraction_prompt,
    get_repair_prompt,
    get_classify_prompt,
    estimate_tokens,
    get_optimal_tier,
)


class TestPromptManager:
    """Test PromptManager class."""
    
    @pytest.fixture
    def manager(self):
        """Create a prompt manager for testing."""
        return PromptManager()
    
    def test_init_default_dir(self, manager):
        """Should initialize with default prompts directory."""
        assert manager.prompts_dir.exists()
        assert manager.prompts_dir.name == "prompts"
    
    def test_get_extraction_prompt_nano(self, manager):
        """Should load NANO tier extraction prompt."""
        prompt = manager.get_extraction_prompt("Test text", tier="NANO")
        
        assert "Test text" in prompt
        assert "JSON" in prompt
        # NANO prompt should be compact
        assert len(prompt) < 2000
    
    def test_get_extraction_prompt_mini(self, manager):
        """Should load MINI tier extraction prompt."""
        prompt = manager.get_extraction_prompt("Test text", tier="MINI")
        
        assert "Test text" in prompt
        assert "evidence" in prompt.lower()
    
    def test_get_extraction_prompt_frontier(self, manager):
        """Should load FRONTIER tier extraction prompt."""
        prompt = manager.get_extraction_prompt("Test text", tier="FRONTIER")
        
        assert "Test text" in prompt
        assert "Clavien-Dindo" in prompt  # FRONTIER has detailed guidance
        assert len(prompt) > 5000  # FRONTIER is comprehensive
    
    def test_get_extraction_prompt_default(self, manager):
        """Should use MINI as default tier."""
        prompt = manager.get_extraction_prompt("Test text")
        
        assert "Test text" in prompt
    
    def test_get_repair_prompt(self, manager):
        """Should load repair prompt with malformed JSON."""
        malformed = '{"test": "value",}'
        prompt = manager.get_repair_prompt(malformed)
        
        assert malformed in prompt
        assert "repair" in prompt.lower() or "fix" in prompt.lower()
    
    def test_get_classify_prompt(self, manager):
        """Should load classification prompt."""
        prompt = manager.get_classify_prompt("Operative report...")
        
        assert "Operative report..." in prompt
        assert "operative_note" in prompt
    
    def test_get_prompt_info(self, manager):
        """Should return prompt metadata."""
        info = manager.get_prompt_info("extraction", tier="NANO")
        
        assert isinstance(info, PromptInfo)
        assert info.name == "extraction"
        assert info.tier == "NANO"
        assert info.char_count > 0
        assert info.estimated_tokens > 0
        assert "input_text" in info.variables
    
    def test_get_prompt_info_version(self, manager):
        """Should detect prompt version correctly."""
        nano_info = manager.get_prompt_info("extraction", "NANO")
        assert "nano" in nano_info.version.lower()
        
        frontier_info = manager.get_prompt_info("extraction", "FRONTIER")
        assert "frontier" in frontier_info.version.lower()
    
    def test_estimate_request_tokens(self, manager):
        """Should estimate total request tokens."""
        input_text = "This is a test clinical note with some content." * 10
        
        estimate = manager.estimate_request_tokens("extraction", input_text, tier="MINI")
        
        assert "prompt_base_tokens" in estimate
        assert "input_tokens" in estimate
        assert "total_request_tokens" in estimate
        assert estimate["total_request_tokens"] == estimate["prompt_base_tokens"] + estimate["input_tokens"]
    
    def test_list_prompts(self, manager):
        """Should list all available prompts."""
        prompts = manager.list_prompts()
        
        assert len(prompts) > 0
        assert all("name" in p for p in prompts)
        assert all("tier" in p for p in prompts)
        assert any(p["name"] == "extraction" for p in prompts)


class TestGetOptimalTier:
    """Test tier selection logic."""
    
    @pytest.fixture
    def manager(self):
        return PromptManager()
    
    def test_short_text_uses_mini(self, manager):
        """Short text should use MINI tier."""
        short_text = "Patient had appendectomy. No complications."
        tier = manager.get_optimal_tier(short_text)
        
        assert tier in ["MINI", "NANO"]
    
    def test_prefer_quality_uses_frontier(self, manager):
        """Should use FRONTIER when quality preferred and fits."""
        short_text = "Patient had appendectomy. No complications."
        tier = manager.get_optimal_tier(short_text, prefer_quality=True)
        
        assert tier == "FRONTIER"
    
    def test_long_text_uses_nano(self, manager):
        """Very long text should fallback to NANO."""
        long_text = "Clinical note content. " * 2000  # Very long
        tier = manager.get_optimal_tier(long_text, max_tokens=4000)
        
        assert tier == "NANO"


class TestPromptInfoDataclass:
    """Test PromptInfo dataclass."""
    
    def test_to_dict(self):
        """Should convert to dictionary."""
        info = PromptInfo(
            name="test",
            tier="MINI",
            version="2.0",
            path=Path("/tmp/test.txt"),
            char_count=1000,
            estimated_tokens=250,
            variables=["input_text"],
        )
        
        d = info.to_dict()
        
        assert d["name"] == "test"
        assert d["tier"] == "MINI"
        assert d["estimated_tokens"] == 250


class TestPromptError:
    """Test PromptError exception."""
    
    def test_invalid_prompt_type(self):
        """Should raise error for invalid prompt type."""
        manager = PromptManager()
        
        with pytest.raises(PromptError) as exc_info:
            manager.get_prompt("invalid_type")
        
        assert "Unknown prompt type" in str(exc_info.value)
    
    def test_missing_variable_leaves_placeholder(self):
        """Missing variables should leave placeholder in output."""
        manager = PromptManager()
        
        # Get prompt without providing input_text
        prompt = manager.get_prompt("extraction", tier="NANO")
        
        # Should contain the unsubstituted placeholder
        assert "{input_text}" in prompt


class TestConvenienceFunctions:
    """Test module-level convenience functions."""
    
    def test_get_prompt_manager_singleton(self):
        """Should return same instance."""
        pm1 = get_prompt_manager()
        pm2 = get_prompt_manager()
        
        assert pm1 is pm2
    
    def test_get_extraction_prompt_function(self):
        """Should work as convenience function."""
        prompt = get_extraction_prompt("Test text", tier="NANO")
        
        assert "Test text" in prompt
    
    def test_get_repair_prompt_function(self):
        """Should work as convenience function."""
        prompt = get_repair_prompt('{"broken": }')
        
        assert '{"broken": }' in prompt
    
    def test_get_classify_prompt_function(self):
        """Should work as convenience function."""
        prompt = get_classify_prompt("Surgery note")
        
        assert "Surgery note" in prompt
    
    def test_estimate_tokens_function(self):
        """Should estimate tokens."""
        estimate = estimate_tokens("Test clinical text")
        
        assert "total_request_tokens" in estimate
        assert estimate["total_request_tokens"] > 0
    
    def test_get_optimal_tier_function(self):
        """Should recommend tier."""
        tier = get_optimal_tier("Short text")
        
        assert tier in ["NANO", "MINI", "FRONTIER"]


class TestPromptContent:
    """Test prompt content requirements."""
    
    @pytest.fixture
    def manager(self):
        return PromptManager()
    
    def test_nano_has_schema(self, manager):
        """NANO prompt should include JSON schema."""
        prompt = manager.get_extraction_prompt("test", tier="NANO")
        
        assert "diagnoses" in prompt
        assert "procedures" in prompt
        assert "medications" in prompt
    
    def test_mini_has_evidence_guidance(self, manager):
        """MINI prompt should explain evidence format."""
        prompt = manager.get_extraction_prompt("test", tier="MINI")
        
        assert "evidence" in prompt.lower()
        assert "quote" in prompt.lower()
    
    def test_frontier_has_examples(self, manager):
        """FRONTIER prompt should include examples."""
        prompt = manager.get_extraction_prompt("test", tier="FRONTIER")
        
        assert "example" in prompt.lower()
        assert "laparoscopic" in prompt.lower()  # From example
    
    def test_frontier_has_clavien_dindo(self, manager):
        """FRONTIER prompt should explain Clavien-Dindo classification."""
        prompt = manager.get_extraction_prompt("test", tier="FRONTIER")
        
        assert "Clavien-Dindo" in prompt or "clavien" in prompt.lower()
    
    def test_repair_has_common_issues(self, manager):
        """Repair prompt should list common JSON issues."""
        prompt = manager.get_repair_prompt('{}')
        
        assert "trailing comma" in prompt.lower() or "Trailing comma" in prompt


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
