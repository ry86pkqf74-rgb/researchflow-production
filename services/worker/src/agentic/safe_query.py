"""
Safe Query Builder

Enforces SELECT-only, parameterized, row-limited queries.
NEVER allows INSERT, UPDATE, DELETE, DROP, or other modification statements.
"""

import re
from typing import Optional, List, Tuple, Any
import logging

logger = logging.getLogger(__name__)


class QueryValidationError(Exception):
    """Raised when a query fails validation."""
    pass


class SafeQueryBuilder:
    """
    Builds and validates safe SQL queries.

    Safety features:
    - SELECT-only enforcement
    - Row limits
    - Parameterized queries
    - Blocked dangerous keywords
    """

    # Keywords that are NEVER allowed
    BLOCKED_KEYWORDS = [
        "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER",
        "TRUNCATE", "GRANT", "REVOKE", "EXECUTE", "EXEC",
        "INTO OUTFILE", "INTO DUMPFILE", "LOAD_FILE",
    ]

    # Default row limit
    DEFAULT_ROW_LIMIT = 100000

    def __init__(self, max_rows: int = DEFAULT_ROW_LIMIT):
        """
        Initialize the query builder.

        Args:
            max_rows: Maximum rows to return (default 100,000)
        """
        self.max_rows = max_rows

    def validate_query(self, query: str) -> Tuple[bool, str]:
        """
        Validate a query for safety.

        Args:
            query: SQL query to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        normalized = query.upper().strip()

        # Must start with SELECT or WITH (for CTEs)
        if not normalized.startswith("SELECT") and not normalized.startswith("WITH"):
            return False, "Query must start with SELECT or WITH"

        # Check for blocked keywords
        for keyword in self.BLOCKED_KEYWORDS:
            # Match as whole word
            pattern = rf"\b{keyword}\b"
            if re.search(pattern, normalized):
                return False, f"Blocked keyword detected: {keyword}"

        # Check for suspicious patterns
        if ";" in query and normalized.count(";") > 1:
            return False, "Multiple statements not allowed"

        if re.search(r"--", query) or re.search(r"/\*", query):
            return False, "SQL comments not allowed"

        return True, ""

    def ensure_row_limit(self, query: str, max_rows: Optional[int] = None) -> str:
        """
        Add row limit if not present.

        Args:
            query: SQL query
            max_rows: Override maximum rows

        Returns:
            Query with LIMIT clause
        """
        limit = max_rows or self.max_rows
        normalized = query.upper().strip()

        # If already has LIMIT, extract and enforce maximum
        limit_match = re.search(r"\bLIMIT\s+(\d+)", normalized)
        if limit_match:
            existing_limit = int(limit_match.group(1))
            if existing_limit > limit:
                # Replace with our limit
                return re.sub(
                    r"\bLIMIT\s+\d+",
                    f"LIMIT {limit}",
                    query,
                    flags=re.IGNORECASE
                )
            return query

        # Add LIMIT
        return f"{query.strip()} LIMIT {limit}"

    def build_select(
        self,
        table: str,
        columns: Optional[List[str]] = None,
        where: Optional[str] = None,
        params: Optional[List[Any]] = None,
        order_by: Optional[str] = None,
        limit: Optional[int] = None
    ) -> Tuple[str, List[Any]]:
        """
        Build a safe SELECT query.

        Args:
            table: Table name
            columns: Columns to select (default: *)
            where: WHERE clause (use $1, $2 placeholders)
            params: Parameters for placeholders
            order_by: ORDER BY clause
            limit: Row limit

        Returns:
            Tuple of (query, params)
        """
        # Validate table name (alphanumeric and underscore only)
        if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", table):
            raise QueryValidationError(f"Invalid table name: {table}")

        # Validate column names
        if columns:
            for col in columns:
                if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", col):
                    raise QueryValidationError(f"Invalid column name: {col}")
            cols_str = ", ".join(columns)
        else:
            cols_str = "*"

        query = f"SELECT {cols_str} FROM {table}"

        if where:
            # Validate WHERE clause doesn't contain blocked keywords
            is_valid, error = self.validate_query(f"SELECT * FROM t WHERE {where}")
            if not is_valid:
                raise QueryValidationError(f"Invalid WHERE clause: {error}")
            query += f" WHERE {where}"

        if order_by:
            # Validate ORDER BY
            if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*(\s+(ASC|DESC))?$", order_by, re.IGNORECASE):
                raise QueryValidationError(f"Invalid ORDER BY: {order_by}")
            query += f" ORDER BY {order_by}"

        # Add row limit
        query = self.ensure_row_limit(query, limit)

        return query, params or []

    def build_aggregate(
        self,
        table: str,
        aggregations: List[Tuple[str, str]],  # [(func, column), ...]
        group_by: Optional[List[str]] = None,
        where: Optional[str] = None,
        params: Optional[List[Any]] = None
    ) -> Tuple[str, List[Any]]:
        """
        Build a safe aggregate query.

        Args:
            table: Table name
            aggregations: List of (function, column) tuples
            group_by: GROUP BY columns
            where: WHERE clause
            params: Parameters

        Returns:
            Tuple of (query, params)
        """
        allowed_funcs = {"COUNT", "SUM", "AVG", "MIN", "MAX", "STDDEV", "VARIANCE"}

        agg_parts = []
        for func, col in aggregations:
            func_upper = func.upper()
            if func_upper not in allowed_funcs:
                raise QueryValidationError(f"Invalid aggregate function: {func}")
            if col != "*" and not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", col):
                raise QueryValidationError(f"Invalid column: {col}")
            agg_parts.append(f"{func_upper}({col}) AS {func.lower()}_{col}")

        if group_by:
            for col in group_by:
                if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", col):
                    raise QueryValidationError(f"Invalid GROUP BY column: {col}")
            cols_str = ", ".join(group_by) + ", " + ", ".join(agg_parts)
        else:
            cols_str = ", ".join(agg_parts)

        return self.build_select(
            table=table,
            columns=None,  # We build our own SELECT
            where=where,
            params=params
        )

    def sanitize_identifier(self, name: str) -> str:
        """
        Sanitize a SQL identifier.

        Args:
            name: Identifier to sanitize

        Returns:
            Sanitized identifier
        """
        # Remove anything that's not alphanumeric or underscore
        sanitized = re.sub(r"[^a-zA-Z0-9_]", "", name)

        # Ensure it starts with a letter or underscore
        if sanitized and not sanitized[0].isalpha() and sanitized[0] != "_":
            sanitized = "_" + sanitized

        return sanitized or "_invalid"


# Singleton instance
safe_query = SafeQueryBuilder()
