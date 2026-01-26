"""
API module initialization.

Note: Conference API routes are implemented directly in api_server.py
rather than as a separate router module. This is intentional to keep
all FastAPI endpoints in one place for easier maintenance.

See api_server.py for conference endpoints:
- POST /api/ros/conference/discover
- POST /api/ros/conference/guidelines/extract
- POST /api/ros/conference/materials/export
- GET /api/ros/conference/bundle/{run_id}/download
"""

__all__ = []
