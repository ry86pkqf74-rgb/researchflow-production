"""
Epic Backend OAuth 2.0 Authentication

Backend OAuth 2.0 token acquisition using a JWT client assertion.

Many SMART backend services flows use:
- grant_type=client_credentials
- client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer
- client_assertion=<signed JWT>

Based on document_pdf.pdf specification (pages 6-8).

Environment Variables:
    EPIC_TOKEN_URL: OAuth token endpoint
    EPIC_CLIENT_ID: Registered client ID
    EPIC_PRIVATE_KEY_PEM: RSA private key for JWT signing
    EPIC_JWT_KID: Key ID (optional, for key rotation)
    EPIC_SCOPE: OAuth scopes (optional, depends on server config)
    EPIC_TIMEOUT_S: Request timeout (default: 60)

Registration Notes:
    - Backend OAuth apps commonly require uploading a JWT public key
      and/or client secret depending on auth method
    - Scopes and resource availability vary by Epic org
"""

from __future__ import annotations

import logging
import os
import time
import uuid
from dataclasses import dataclass
from typing import Any, Dict, Optional

import jwt  # PyJWT
import requests

logger = logging.getLogger(__name__)


class EpicAuthError(Exception):
    """Raised when Epic authentication fails."""
    pass


@dataclass(frozen=True)
class EpicBackendAuthConfig:
    """
    Configuration for Epic backend OAuth authentication.

    All configuration can be loaded from environment variables
    using the from_env() class method.
    """
    token_url: str
    client_id: str
    private_key_pem: str
    kid: Optional[str] = None
    scope: Optional[str] = None
    timeout_s: int = 60

    @classmethod
    def from_env(cls) -> "EpicBackendAuthConfig":
        """
        Load configuration from environment variables.

        Required:
            EPIC_TOKEN_URL: OAuth token endpoint
            EPIC_CLIENT_ID: Registered client ID
            EPIC_PRIVATE_KEY_PEM: RSA private key (PEM format)

        Optional:
            EPIC_JWT_KID: Key ID for key rotation
            EPIC_SCOPE: OAuth scopes
            EPIC_TIMEOUT_S: Request timeout (default: 60)
        """
        return cls(
            token_url=os.environ["EPIC_TOKEN_URL"],
            client_id=os.environ["EPIC_CLIENT_ID"],
            private_key_pem=os.environ["EPIC_PRIVATE_KEY_PEM"],
            kid=os.getenv("EPIC_JWT_KID"),
            scope=os.getenv("EPIC_SCOPE"),
            timeout_s=int(os.getenv("EPIC_TIMEOUT_S", "60")),
        )


class EpicBackendAuthenticator:
    """
    Backend OAuth 2.0 token acquisition using JWT client assertion.

    This implements the SMART Backend Services authorization flow
    using a signed JWT as the client assertion.

    Example:
        config = EpicBackendAuthConfig.from_env()
        auth = EpicBackendAuthenticator(config)
        token = auth.get_access_token()
    """

    def __init__(self, cfg: EpicBackendAuthConfig) -> None:
        self.cfg = cfg
        self.session = requests.Session()
        self._cached_token: Optional[str] = None
        self._token_expiry: float = 0

    def build_client_assertion(self) -> str:
        """
        Build a signed JWT client assertion.

        The JWT includes:
        - iss: client_id
        - sub: client_id
        - aud: token endpoint URL
        - jti: unique identifier
        - iat: issued at timestamp
        - exp: expiration (5 minutes)

        Returns:
            Signed JWT string
        """
        now = int(time.time())

        payload = {
            "iss": self.cfg.client_id,
            "sub": self.cfg.client_id,
            "aud": self.cfg.token_url,
            "jti": str(uuid.uuid4()),
            "iat": now,
            "exp": now + 300,  # 5 minutes
        }

        headers: Dict[str, Any] = {"typ": "JWT", "alg": "RS256"}
        if self.cfg.kid:
            headers["kid"] = self.cfg.kid

        return jwt.encode(
            payload,
            self.cfg.private_key_pem,
            algorithm="RS256",
            headers=headers,
        )

    def get_access_token(self, *, force_refresh: bool = False) -> str:
        """
        Get an access token, using cached value if valid.

        Args:
            force_refresh: Force token refresh even if cached token is valid

        Returns:
            OAuth access token string

        Raises:
            EpicAuthError: If token acquisition fails
        """
        # Check cache
        if not force_refresh and self._cached_token and time.time() < self._token_expiry:
            return self._cached_token

        assertion = self.build_client_assertion()

        data: Dict[str, str] = {
            "grant_type": "client_credentials",
            "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
            "client_assertion": assertion,
        }

        if self.cfg.scope:
            data["scope"] = self.cfg.scope

        logger.debug(f"Requesting token from {self.cfg.token_url}")

        try:
            resp = self.session.post(
                self.cfg.token_url,
                data=data,
                timeout=self.cfg.timeout_s
            )
            resp.raise_for_status()
        except requests.RequestException as e:
            raise EpicAuthError(f"Token request failed: {e}") from e

        token_data = resp.json()
        token = token_data.get("access_token")

        if not token:
            raise EpicAuthError(f"Token response missing access_token: {resp.text[:500]}")

        # Cache token with expiry buffer (refresh 60s before expiry)
        expires_in = token_data.get("expires_in", 300)
        self._cached_token = token
        self._token_expiry = time.time() + expires_in - 60

        logger.info(f"Acquired Epic access token, expires in {expires_in}s")
        return token
