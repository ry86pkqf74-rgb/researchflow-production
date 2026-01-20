"""Copyleaks Plagiarism Provider Integration.

This module provides integration with the Copyleaks plagiarism detection API.
Only active when COPYLEAKS_API_KEY and COPYLEAKS_EMAIL environment variables
are configured.

Design Principles:
- Fail-closed: any error blocks the check
- Rate limiting awareness with backoff
- Sandbox vs production toggle via COPYLEAKS_SANDBOX
- PHI-safe: never log or store raw matched text

API Reference: https://api.copyleaks.com/documentation
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from .provider import (
    PlagiarismCheckError,
    PlagiarismMatch,
    PlagiarismProvider,
    PlagiarismResult,
    ProviderStatus,
    hash_matched_text,
)

logger = logging.getLogger(__name__)

# Copyleaks API endpoints
COPYLEAKS_API_BASE = "https://api.copyleaks.com"
COPYLEAKS_SANDBOX_BASE = "https://sandbox.copyleaks.com"

# Rate limiting configuration
DEFAULT_RATE_LIMIT_WINDOW = 60  # seconds
DEFAULT_MAX_REQUESTS_PER_WINDOW = 10
RATE_LIMIT_BACKOFF_SECONDS = 30


@dataclass
class CopyleaksCredentials:
    """Copyleaks API credentials."""
    api_key: str
    email: str
    access_token: Optional[str] = None
    token_expires_at: Optional[datetime] = None

    @property
    def is_token_valid(self) -> bool:
        """Check if the access token is still valid."""
        if not self.access_token or not self.token_expires_at:
            return False
        # Add 5 minute buffer
        return datetime.now(timezone.utc) < (self.token_expires_at - timedelta(minutes=5))


@dataclass
class RateLimitState:
    """Tracks rate limit state for the provider."""
    request_count: int = 0
    window_start: datetime = field(default_factory=datetime.utcnow)
    is_rate_limited: bool = False
    rate_limit_until: Optional[datetime] = None

    def reset_if_window_expired(self, window_seconds: int = DEFAULT_RATE_LIMIT_WINDOW) -> None:
        """Reset counter if the rate limit window has expired."""
        now = datetime.now(timezone.utc)
        if (now - self.window_start).total_seconds() >= window_seconds:
            self.request_count = 0
            self.window_start = now

    def is_allowed(self, max_requests: int = DEFAULT_MAX_REQUESTS_PER_WINDOW) -> bool:
        """Check if a request is allowed within rate limits."""
        self.reset_if_window_expired()

        # Check if we're in a rate limit backoff period
        if self.is_rate_limited and self.rate_limit_until:
            if datetime.now(timezone.utc) < self.rate_limit_until:
                return False
            # Backoff period has passed
            self.is_rate_limited = False
            self.rate_limit_until = None

        return self.request_count < max_requests

    def record_request(self) -> None:
        """Record that a request was made."""
        self.request_count += 1

    def record_rate_limit(self, backoff_seconds: int = RATE_LIMIT_BACKOFF_SECONDS) -> None:
        """Record that we hit a rate limit."""
        self.is_rate_limited = True
        self.rate_limit_until = datetime.now(timezone.utc) + timedelta(seconds=backoff_seconds)
        logger.warning(
            f"Copyleaks rate limit hit, backing off until {self.rate_limit_until.isoformat()}"
        )


class CopyleaksProvider(PlagiarismProvider):
    """Copyleaks plagiarism detection provider.

    This provider integrates with the Copyleaks API for production-grade
    plagiarism detection. Requires COPYLEAKS_API_KEY and COPYLEAKS_EMAIL
    environment variables to be set.

    Features:
    - Automatic token refresh
    - Rate limiting with backoff
    - Sandbox mode for testing
    - Fail-closed error handling
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        email: Optional[str] = None,
        sandbox: bool = False,
        timeout: int = 30,
    ):
        """Initialize the Copyleaks provider.

        Args:
            api_key: Copyleaks API key (or from COPYLEAKS_API_KEY env)
            email: Copyleaks account email (or from COPYLEAKS_EMAIL env)
            sandbox: Whether to use sandbox API (or from COPYLEAKS_SANDBOX env)
            timeout: HTTP request timeout in seconds
        """
        self._api_key = api_key or os.getenv("COPYLEAKS_API_KEY")
        self._email = email or os.getenv("COPYLEAKS_EMAIL")
        self._sandbox = sandbox or os.getenv("COPYLEAKS_SANDBOX", "").lower() in ("1", "true", "yes")
        self._timeout = timeout

        self._credentials: Optional[CopyleaksCredentials] = None
        self._rate_limit = RateLimitState()

        # Determine API base URL
        self._api_base = COPYLEAKS_SANDBOX_BASE if self._sandbox else COPYLEAKS_API_BASE

        logger.info(
            f"Copyleaks provider initialized: sandbox={self._sandbox}, "
            f"api_base={self._api_base}, configured={self.is_configured}"
        )

    @property
    def name(self) -> str:
        """Get the provider name."""
        return "copyleaks"

    @property
    def is_configured(self) -> bool:
        """Check if the provider has valid configuration."""
        return bool(self._api_key and self._email)

    def get_status(self) -> ProviderStatus:
        """Get the current status of the provider.

        Returns:
            ProviderStatus based on configuration and rate limit state
        """
        if not self.is_configured:
            return ProviderStatus.UNAVAILABLE

        if self._rate_limit.is_rate_limited:
            if self._rate_limit.rate_limit_until and datetime.now(timezone.utc) < self._rate_limit.rate_limit_until:
                return ProviderStatus.RATE_LIMITED

        if self._sandbox:
            return ProviderStatus.SANDBOX

        return ProviderStatus.AVAILABLE

    def check(self, text: str, document_id: str) -> PlagiarismResult:
        """Perform a plagiarism check using Copyleaks API.

        This is a fail-closed implementation: any error will raise
        PlagiarismCheckError to prevent proceeding without a valid check.

        Args:
            text: The text to check for plagiarism
            document_id: Unique identifier for the document

        Returns:
            PlagiarismResult with similarity score and matches

        Raises:
            PlagiarismCheckError: If provider is not configured, rate limited,
                or API call fails
        """
        # Fail-closed: check configuration
        if not self.is_configured:
            raise PlagiarismCheckError(
                "Copyleaks provider not configured: missing COPYLEAKS_API_KEY or COPYLEAKS_EMAIL",
                reason_code="PROVIDER_NOT_CONFIGURED",
                is_retriable=False,
            )

        # Fail-closed: check rate limits
        if not self._rate_limit.is_allowed():
            raise PlagiarismCheckError(
                "Copyleaks rate limit exceeded, try again later",
                reason_code="RATE_LIMITED",
                is_retriable=True,
            )

        logger.info(
            f"Copyleaks check started: document_id={document_id}, "
            f"text_length={len(text)}, sandbox={self._sandbox}"
        )

        try:
            # Ensure we have a valid access token
            self._ensure_authenticated()

            # Submit the scan
            scan_id = self._submit_scan(text, document_id)

            # Poll for results (Copyleaks is async)
            result = self._poll_for_results(scan_id, document_id)

            self._rate_limit.record_request()

            logger.info(
                f"Copyleaks check completed: document_id={document_id}, "
                f"scan_id={scan_id}, similarity={result.similarity_score:.2%}, "
                f"matches={result.match_count}"
            )

            return result

        except PlagiarismCheckError:
            raise
        except urllib.error.HTTPError as e:
            if e.code == 429:
                self._rate_limit.record_rate_limit()
                raise PlagiarismCheckError(
                    "Copyleaks rate limit exceeded",
                    reason_code="RATE_LIMITED",
                    is_retriable=True,
                ) from e
            elif e.code == 401:
                raise PlagiarismCheckError(
                    "Copyleaks authentication failed",
                    reason_code="AUTH_FAILED",
                    is_retriable=False,
                ) from e
            else:
                raise PlagiarismCheckError(
                    f"Copyleaks API error: HTTP {e.code}",
                    reason_code="API_ERROR",
                    is_retriable=e.code >= 500,
                ) from e
        except urllib.error.URLError as e:
            raise PlagiarismCheckError(
                "Network error connecting to Copyleaks",
                reason_code="NETWORK_ERROR",
                is_retriable=True,
            ) from e
        except Exception as e:
            # Fail-closed: any unexpected error blocks the check
            logger.exception(f"Unexpected error in Copyleaks check: {e}")
            raise PlagiarismCheckError(
                "Unexpected error during plagiarism check",
                reason_code="UNEXPECTED_ERROR",
                is_retriable=False,
            ) from e

    def _ensure_authenticated(self) -> None:
        """Ensure we have a valid access token.

        Raises:
            PlagiarismCheckError: If authentication fails
        """
        if self._credentials and self._credentials.is_token_valid:
            return

        logger.debug("Authenticating with Copyleaks API")

        auth_url = f"{self._api_base}/v3/account/login/api"
        auth_data = json.dumps({
            "email": self._email,
            "key": self._api_key,
        }).encode("utf-8")

        request = urllib.request.Request(
            auth_url,
            data=auth_data,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "ROS-Plagiarism/1.0",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=self._timeout) as response:
                result = json.loads(response.read().decode("utf-8"))

            access_token = result.get("access_token")
            expires_in = result.get("expires_in", 3600)  # Default 1 hour

            if not access_token:
                raise PlagiarismCheckError(
                    "Copyleaks authentication failed: no access token returned",
                    reason_code="AUTH_FAILED",
                    is_retriable=False,
                )

            self._credentials = CopyleaksCredentials(
                api_key=self._api_key or "",
                email=self._email or "",
                access_token=access_token,
                token_expires_at=datetime.now(timezone.utc) + timedelta(seconds=expires_in),
            )

            logger.debug(
                f"Copyleaks authentication successful, token expires at "
                f"{self._credentials.token_expires_at.isoformat()}"
            )

        except urllib.error.HTTPError as e:
            raise PlagiarismCheckError(
                f"Copyleaks authentication failed: HTTP {e.code}",
                reason_code="AUTH_FAILED",
                is_retriable=False,
            ) from e

    def _submit_scan(self, text: str, document_id: str) -> str:
        """Submit a text for scanning.

        Args:
            text: The text to scan
            document_id: Document identifier

        Returns:
            Scan ID for polling results

        Raises:
            PlagiarismCheckError: If scan submission fails
        """
        if not self._credentials or not self._credentials.access_token:
            raise PlagiarismCheckError(
                "Not authenticated",
                reason_code="AUTH_REQUIRED",
                is_retriable=False,
            )

        # Generate a unique scan ID
        scan_id = hashlib.sha256(
            f"{document_id}:{datetime.now(timezone.utc).isoformat()}".encode("utf-8")
        ).hexdigest()[:16]

        submit_url = f"{self._api_base}/v3/scans/submit/file/{scan_id}"

        # Copyleaks expects base64 encoded text for file submissions
        import base64
        encoded_text = base64.b64encode(text.encode("utf-8")).decode("utf-8")

        submit_data = json.dumps({
            "base64": encoded_text,
            "filename": f"{document_id}.txt",
            "properties": {
                "sandbox": self._sandbox,
                "webhooks": {
                    # In production, you'd configure webhook URLs here
                },
            },
        }).encode("utf-8")

        request = urllib.request.Request(
            submit_url,
            data=submit_data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self._credentials.access_token}",
                "User-Agent": "ROS-Plagiarism/1.0",
            },
            method="PUT",
        )

        try:
            with urllib.request.urlopen(request, timeout=self._timeout) as response:
                if response.status not in (200, 201, 202):
                    raise PlagiarismCheckError(
                        f"Scan submission failed: HTTP {response.status}",
                        reason_code="SCAN_SUBMIT_FAILED",
                        is_retriable=True,
                    )

            logger.debug(f"Scan submitted successfully: scan_id={scan_id}")
            return scan_id

        except urllib.error.HTTPError as e:
            raise PlagiarismCheckError(
                f"Scan submission failed: HTTP {e.code}",
                reason_code="SCAN_SUBMIT_FAILED",
                is_retriable=e.code >= 500,
            ) from e

    def _poll_for_results(
        self,
        scan_id: str,
        document_id: str,
        max_attempts: int = 30,
        poll_interval: float = 2.0,
    ) -> PlagiarismResult:
        """Poll for scan results.

        Copyleaks processes scans asynchronously, so we need to poll
        for completion.

        Args:
            scan_id: The scan ID to poll for
            document_id: Original document ID
            max_attempts: Maximum polling attempts
            poll_interval: Seconds between polls

        Returns:
            PlagiarismResult when scan completes

        Raises:
            PlagiarismCheckError: If polling times out or fails
        """
        if not self._credentials or not self._credentials.access_token:
            raise PlagiarismCheckError(
                "Not authenticated",
                reason_code="AUTH_REQUIRED",
                is_retriable=False,
            )

        status_url = f"{self._api_base}/v3/scans/{scan_id}/status"

        for attempt in range(max_attempts):
            request = urllib.request.Request(
                status_url,
                headers={
                    "Authorization": f"Bearer {self._credentials.access_token}",
                    "User-Agent": "ROS-Plagiarism/1.0",
                },
                method="GET",
            )

            try:
                with urllib.request.urlopen(request, timeout=self._timeout) as response:
                    result = json.loads(response.read().decode("utf-8"))

                status = result.get("status", "").lower()

                if status == "completed":
                    return self._fetch_results(scan_id, document_id)
                elif status in ("error", "failed"):
                    raise PlagiarismCheckError(
                        f"Scan failed with status: {status}",
                        reason_code="SCAN_FAILED",
                        is_retriable=False,
                    )
                elif status in ("pending", "processing"):
                    logger.debug(f"Scan {scan_id} still processing, attempt {attempt + 1}/{max_attempts}")
                    time.sleep(poll_interval)
                else:
                    logger.warning(f"Unknown scan status: {status}")
                    time.sleep(poll_interval)

            except urllib.error.HTTPError as e:
                if e.code == 404:
                    # Scan not found yet, keep polling
                    time.sleep(poll_interval)
                else:
                    raise PlagiarismCheckError(
                        f"Failed to check scan status: HTTP {e.code}",
                        reason_code="STATUS_CHECK_FAILED",
                        is_retriable=e.code >= 500,
                    ) from e

        raise PlagiarismCheckError(
            f"Scan timed out after {max_attempts * poll_interval} seconds",
            reason_code="SCAN_TIMEOUT",
            is_retriable=True,
        )

    def _fetch_results(self, scan_id: str, document_id: str) -> PlagiarismResult:
        """Fetch the final results of a completed scan.

        Args:
            scan_id: The completed scan ID
            document_id: Original document ID

        Returns:
            PlagiarismResult with matches and similarity score
        """
        if not self._credentials or not self._credentials.access_token:
            raise PlagiarismCheckError(
                "Not authenticated",
                reason_code="AUTH_REQUIRED",
                is_retriable=False,
            )

        results_url = f"{self._api_base}/v3/scans/{scan_id}/results"

        request = urllib.request.Request(
            results_url,
            headers={
                "Authorization": f"Bearer {self._credentials.access_token}",
                "User-Agent": "ROS-Plagiarism/1.0",
            },
            method="GET",
        )

        try:
            with urllib.request.urlopen(request, timeout=self._timeout) as response:
                result = json.loads(response.read().decode("utf-8"))

            # Parse Copyleaks results format
            similarity_score = result.get("aggregatedScore", 0) / 100.0  # Convert to 0-1
            internet_results = result.get("results", {}).get("internet", [])
            database_results = result.get("results", {}).get("database", [])

            matches = self._parse_matches(internet_results + database_results)

            return PlagiarismResult(
                similarity_score=similarity_score,
                matches=matches,
                provider=self.name,
                checked_at=datetime.now(timezone.utc),
                document_id=document_id,
                scan_id=scan_id,
                is_mock=False,
            )

        except urllib.error.HTTPError as e:
            raise PlagiarismCheckError(
                f"Failed to fetch results: HTTP {e.code}",
                reason_code="RESULTS_FETCH_FAILED",
                is_retriable=e.code >= 500,
            ) from e

    def _parse_matches(self, results: List[Dict[str, Any]]) -> List[PlagiarismMatch]:
        """Parse Copyleaks result items into PlagiarismMatch objects.

        PHI Safety: All matched text is hashed, never stored as raw text.

        Args:
            results: List of result items from Copyleaks

        Returns:
            List of PlagiarismMatch objects
        """
        matches: List[PlagiarismMatch] = []

        for item in results:
            url = item.get("url", "")
            title = item.get("title", "Unknown source")
            match_score = item.get("matchedPercent", 0) / 100.0

            # Get matched text segments (for hashing only)
            for comparison in item.get("comparisons", []):
                # Hash the matched text for PHI safety
                matched_text = comparison.get("matchedText", "")
                matched_text_hash = hash_matched_text(matched_text) if matched_text else ""

                start_pos = comparison.get("start", 0)
                end_pos = comparison.get("end", 0)

                matches.append(PlagiarismMatch(
                    source_url=url,
                    source_title=title,
                    matched_text_hash=matched_text_hash,
                    similarity=match_score,
                    start_position=start_pos,
                    end_position=end_pos,
                ))

        return matches


def get_copyleaks_provider() -> Optional[CopyleaksProvider]:
    """Get a Copyleaks provider if configured.

    Returns:
        CopyleaksProvider if COPYLEAKS_API_KEY and COPYLEAKS_EMAIL are set,
        None otherwise
    """
    api_key = os.getenv("COPYLEAKS_API_KEY")
    email = os.getenv("COPYLEAKS_EMAIL")

    if not api_key or not email:
        logger.debug("Copyleaks not configured: missing API key or email")
        return None

    return CopyleaksProvider(api_key=api_key, email=email)


def is_copyleaks_configured() -> bool:
    """Check if Copyleaks credentials are configured.

    Returns:
        True if both COPYLEAKS_API_KEY and COPYLEAKS_EMAIL are set
    """
    return bool(os.getenv("COPYLEAKS_API_KEY") and os.getenv("COPYLEAKS_EMAIL"))
