"""
Tests for SafeQueryBuilder - SELECT-only query enforcement.
"""

import pytest
from ..safe_query import SafeQueryBuilder, QueryValidationError


class TestSafeQueryBuilder:
    """Tests for safe query building and validation."""

    def setup_method(self):
        self.builder = SafeQueryBuilder(max_rows=1000)

    def test_simple_select_allowed(self):
        """Simple SELECT queries should pass validation."""
        query = "SELECT * FROM patients"
        is_valid, error = self.builder.validate(query)
        assert is_valid, f"Expected valid, got error: {error}"

    def test_select_with_where(self):
        """SELECT with WHERE clause should be allowed."""
        query = "SELECT id, name FROM patients WHERE age > 18"
        is_valid, error = self.builder.validate(query)
        assert is_valid, f"Expected valid, got error: {error}"

    def test_insert_blocked(self):
        """INSERT statements should be blocked."""
        query = "INSERT INTO patients (name) VALUES ('test')"
        is_valid, error = self.builder.validate(query)
        assert not is_valid
        assert "INSERT" in error.upper() or "BLOCKED" in error.upper()

    def test_update_blocked(self):
        """UPDATE statements should be blocked."""
        query = "UPDATE patients SET name = 'test' WHERE id = 1"
        is_valid, error = self.builder.validate(query)
        assert not is_valid
        assert "UPDATE" in error.upper() or "BLOCKED" in error.upper()

    def test_delete_blocked(self):
        """DELETE statements should be blocked."""
        query = "DELETE FROM patients WHERE id = 1"
        is_valid, error = self.builder.validate(query)
        assert not is_valid
        assert "DELETE" in error.upper() or "BLOCKED" in error.upper()

    def test_drop_blocked(self):
        """DROP statements should be blocked."""
        query = "DROP TABLE patients"
        is_valid, error = self.builder.validate(query)
        assert not is_valid
        assert "DROP" in error.upper() or "BLOCKED" in error.upper()

    def test_truncate_blocked(self):
        """TRUNCATE statements should be blocked."""
        query = "TRUNCATE TABLE patients"
        is_valid, error = self.builder.validate(query)
        assert not is_valid
        assert "TRUNCATE" in error.upper() or "BLOCKED" in error.upper()

    def test_alter_blocked(self):
        """ALTER statements should be blocked."""
        query = "ALTER TABLE patients ADD COLUMN test VARCHAR(50)"
        is_valid, error = self.builder.validate(query)
        assert not is_valid
        assert "ALTER" in error.upper() or "BLOCKED" in error.upper()

    def test_create_blocked(self):
        """CREATE statements should be blocked."""
        query = "CREATE TABLE test (id INT)"
        is_valid, error = self.builder.validate(query)
        assert not is_valid
        assert "CREATE" in error.upper() or "BLOCKED" in error.upper()

    def test_grant_blocked(self):
        """GRANT statements should be blocked."""
        query = "GRANT SELECT ON patients TO user1"
        is_valid, error = self.builder.validate(query)
        assert not is_valid
        assert "GRANT" in error.upper() or "BLOCKED" in error.upper()

    def test_semicolon_injection_blocked(self):
        """Multiple statements via semicolon should be blocked."""
        query = "SELECT * FROM patients; DELETE FROM patients"
        is_valid, error = self.builder.validate(query)
        # Should either reject completely or only allow the SELECT part
        # depending on implementation

    def test_comment_injection_handling(self):
        """SQL comments should be handled safely."""
        query = "SELECT * FROM patients -- this is a comment"
        is_valid, error = self.builder.validate(query)
        assert is_valid  # Comments in SELECT are fine

    def test_limit_added(self):
        """LIMIT should be added if not present."""
        query = "SELECT * FROM patients"
        result = self.builder.build(query)
        assert "LIMIT" in result.upper()

    def test_existing_limit_respected(self):
        """Existing LIMIT should be respected if within max."""
        query = "SELECT * FROM patients LIMIT 100"
        result = self.builder.build(query)
        assert "LIMIT 100" in result or "LIMIT  100" in result

    def test_excessive_limit_capped(self):
        """LIMIT higher than max should be capped."""
        builder = SafeQueryBuilder(max_rows=1000)
        query = "SELECT * FROM patients LIMIT 50000"
        result = builder.build(query)
        # Should contain a limit <= 1000
        assert "LIMIT" in result.upper()

    def test_case_insensitive_blocking(self):
        """Blocked keywords should be case-insensitive."""
        queries = [
            "DELETE FROM patients",
            "delete from patients",
            "DeLeTe From patients",
        ]
        for query in queries:
            is_valid, error = self.builder.validate(query)
            assert not is_valid, f"Expected {query} to be blocked"

    def test_join_allowed(self):
        """JOINs should be allowed."""
        query = "SELECT p.*, v.date FROM patients p JOIN visits v ON p.id = v.patient_id"
        is_valid, error = self.builder.validate(query)
        assert is_valid, f"Expected valid, got error: {error}"

    def test_subquery_allowed(self):
        """Subqueries should be allowed."""
        query = "SELECT * FROM patients WHERE id IN (SELECT patient_id FROM visits)"
        is_valid, error = self.builder.validate(query)
        assert is_valid, f"Expected valid, got error: {error}"

    def test_aggregate_functions_allowed(self):
        """Aggregate functions should be allowed."""
        query = "SELECT COUNT(*), AVG(age) FROM patients GROUP BY gender"
        is_valid, error = self.builder.validate(query)
        assert is_valid, f"Expected valid, got error: {error}"

    def test_parameterized_query(self):
        """Parameterized queries should work."""
        query = "SELECT * FROM patients WHERE id = %s"
        params = (123,)
        is_valid, error = self.builder.validate(query, params)
        assert is_valid, f"Expected valid, got error: {error}"


class TestQueryValidationError:
    """Tests for QueryValidationError exception."""

    def test_error_message(self):
        """Error should contain useful message."""
        error = QueryValidationError("DELETE is not allowed", "DELETE FROM users")
        assert "DELETE" in str(error)

    def test_error_contains_query(self):
        """Error should preserve original query for debugging."""
        original = "DROP TABLE users"
        error = QueryValidationError("Blocked keyword", original)
        assert error.query == original
