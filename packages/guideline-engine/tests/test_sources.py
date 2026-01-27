"""Tests for guideline sources module."""

import pytest
from guideline_engine.sources import (
    GUIDELINE_SOURCES,
    discover_url,
    list_sources,
    list_fields,
    list_categories,
)


class TestGuidelineSources:
    """Tests for GUIDELINE_SOURCES dictionary."""

    def test_sources_not_empty(self):
        """Ensure we have guideline sources defined."""
        assert len(GUIDELINE_SOURCES) > 0

    def test_source_structure(self):
        """Verify each source has required fields."""
        required_fields = {"url", "type", "field", "category", "description"}
        for key, value in GUIDELINE_SOURCES.items():
            assert isinstance(key, str), f"Key {key} should be string"
            assert isinstance(value, dict), f"Value for {key} should be dict"
            for field in required_fields:
                assert field in value, f"Source {key} missing field {field}"

    def test_source_urls_valid(self):
        """Verify URLs start with http/https."""
        for key, value in GUIDELINE_SOURCES.items():
            url = value.get("url", "")
            assert url.startswith("http://") or url.startswith("https://"), \
                f"Source {key} has invalid URL: {url}"

    def test_oncology_sources_exist(self):
        """Verify oncology staging sources are present."""
        oncology_keywords = ["tnm", "ajcc", "ecog"]
        oncology_sources = [k for k in GUIDELINE_SOURCES.keys()
                          if any(kw in k.lower() for kw in oncology_keywords)]
        assert len(oncology_sources) >= 3, "Should have multiple oncology sources"

    def test_surgical_sources_exist(self):
        """Verify surgical complication sources are present."""
        assert "clavien-dindo" in GUIDELINE_SOURCES
        assert GUIDELINE_SOURCES["clavien-dindo"]["field"] == "surgery"


class TestDiscoverUrl:
    """Tests for discover_url function."""

    def test_exact_match(self):
        """Test exact key match."""
        result = discover_url("clavien-dindo")
        assert result is not None
        assert "url" in result
        assert result["field"] == "surgery"

    def test_exact_match_case_insensitive(self):
        """Test case-insensitive matching."""
        result = discover_url("CLAVIEN-DINDO")
        assert result is not None

    def test_partial_match(self):
        """Test partial string matching."""
        result = discover_url("clavien")
        assert result is not None
        assert "surgery" in result.get("field", "")

    def test_word_overlap_match(self):
        """Test matching by word overlap."""
        result = discover_url("surgical complications")
        assert result is not None

    def test_no_match(self):
        """Test non-existent guideline returns None."""
        result = discover_url("nonexistent_guideline_xyz")
        assert result is None

    def test_whitespace_handling(self):
        """Test that whitespace is trimmed."""
        result = discover_url("  clavien-dindo  ")
        assert result is not None

    def test_tnm_colorectal(self):
        """Test TNM colorectal staging lookup."""
        result = discover_url("tnm colorectal")
        assert result is not None
        assert result["field"] == "oncology"
        assert result["category"] == "staging"


class TestListSources:
    """Tests for list_sources function."""

    def test_list_all_sources(self):
        """Test listing all sources without filter."""
        sources = list_sources()
        assert len(sources) > 0
        assert all("query" in s for s in sources)

    def test_filter_by_field(self):
        """Test filtering by field."""
        sources = list_sources(field="oncology")
        assert len(sources) > 0
        assert all(s["field"] == "oncology" for s in sources)

    def test_filter_by_category(self):
        """Test filtering by category."""
        sources = list_sources(category="staging")
        assert len(sources) > 0
        assert all(s["category"] == "staging" for s in sources)

    def test_filter_by_field_and_category(self):
        """Test filtering by both field and category."""
        sources = list_sources(field="oncology", category="staging")
        assert len(sources) > 0
        assert all(s["field"] == "oncology" and s["category"] == "staging" for s in sources)

    def test_empty_result_for_invalid_filter(self):
        """Test that invalid filters return empty list."""
        sources = list_sources(field="nonexistent_field")
        assert len(sources) == 0


class TestListFields:
    """Tests for list_fields function."""

    def test_fields_not_empty(self):
        """Test that we have fields defined."""
        fields = list_fields()
        assert len(fields) > 0

    def test_fields_are_sorted(self):
        """Test that fields are sorted alphabetically."""
        fields = list_fields()
        assert fields == sorted(fields)

    def test_expected_fields_present(self):
        """Test that expected medical fields are present."""
        fields = list_fields()
        expected = ["oncology", "surgery"]
        for field in expected:
            assert field in fields, f"Expected field {field} not found"


class TestListCategories:
    """Tests for list_categories function."""

    def test_categories_not_empty(self):
        """Test that we have categories defined."""
        categories = list_categories()
        assert len(categories) > 0

    def test_categories_are_sorted(self):
        """Test that categories are sorted alphabetically."""
        categories = list_categories()
        assert categories == sorted(categories)

    def test_expected_categories_present(self):
        """Test that expected categories are present."""
        categories = list_categories()
        expected = ["staging", "grading", "classification"]
        for cat in expected:
            assert cat in categories, f"Expected category {cat} not found"
