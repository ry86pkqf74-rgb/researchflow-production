from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any, Mapping

if TYPE_CHECKING:
    from src.governance.capabilities import RosMode

logger = logging.getLogger(__name__)


def _parse_bool(value: str | None, default: bool) -> bool:
    """Parse a boolean value from a string.

    Args:
        value: String to parse (or None)
        default: Default value to return if parsing fails

    Returns:
        Parsed boolean value, or default if value is None or invalid

    Note:
        Logs a warning if an invalid value is provided to alert users
        about potential configuration errors. Accepted values are:
        - True: "1", "true", "t", "yes", "y", "on" (case-insensitive)
        - False: "0", "false", "f", "no", "n", "off" (case-insensitive)
    """
    if value is None:
        return default
    v = value.strip().lower()
    if v in {"1", "true", "t", "yes", "y", "on"}:
        return True
    if v in {"0", "false", "f", "no", "n", "off"}:
        return False

    # Invalid value - log warning and fall back to default
    logger.warning(
        f"Invalid boolean value '{value}' provided. "
        f"Accepted values: 1, true, t, yes, y, on (for True) or "
        f"0, false, f, no, n, off (for False). "
        f"Falling back to default: {default}"
    )
    return default


def _parse_int(value: str | None, default: int) -> int:
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _load_yaml(path: Path) -> Mapping[str, Any]:
    # YAML is used throughout this repo; we keep import optional to avoid hard crashes
    # in minimal environments.
    try:
        import yaml  # type: ignore
    except (ImportError, ModuleNotFoundError) as e:  # pragma: no cover
        raise RuntimeError(
            "PyYAML is required to load runtime config YAML files. "
            "Install PyYAML or omit --config."
        ) from e
    with path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    if not isinstance(data, dict):
        raise ValueError(f"Runtime config YAML must be a mapping, got: {type(data)}")
    return data


@dataclass(frozen=True)
class RuntimeConfig:
    """
    Centralized runtime flags.

    Defaults are conservative (STANDBY/offline, fail-closed):
    - NO_NETWORK=True
    - MOCK_ONLY=True
    - ALLOW_UPLOADS=False
    - STRICT_PHI_ON_UPLOAD=True

    Modes:
    - STANDBY: Fail-closed default (OFFLINE is accepted as backward-compatible alias)
    - SANDBOX: Testing with synthetic data
    - ACTIVE: Online/interactive workflows
    - LIVE: Production mode (future)
    """

    ros_mode: str = (
        "STANDBY"  # STANDBY | SANDBOX | ACTIVE | LIVE (OFFLINE alias for STANDBY)
    )
    no_network: bool = True
    mock_only: bool = True
    allow_uploads: bool = False
    strict_phi_on_upload: bool = True
    max_upload_mb: int = 50

    llm_provider: str = "mock"  # mock | openai | anthropic | xai | ...
    literature_provider: str = "pubmed"  # pubmed | semantic_scholar | ...

    # Not a secret; just used for debugging visibility.
    loaded_from: str = "defaults"

    @property
    def is_standby(self) -> bool:
        """
        Check if system is in STANDBY mode.

        Note: "OFFLINE" is accepted as an alias for "STANDBY" for backward compatibility.
        """
        return self.ros_mode.strip().upper() in {"STANDBY", "OFFLINE"}

    @property
    def online_enabled(self) -> bool:
        return (not self.no_network) and (not self.is_standby)

    def to_ros_mode(self) -> "RosMode":
        """Convert runtime config to RosMode enum.

        Uses the same logic as the legacy get_current_mode():
        - If all safety flags are at fail-closed defaults → STANDBY
        - Otherwise use explicit ros_mode (if valid)
        - Falls back to SANDBOX if mode invalid or STANDBY not met

        Returns:
            RosMode enum value
        """
        from src.governance.capabilities import RosMode

        # STANDBY detection: all safety flags at fail-closed defaults
        # This takes precedence over any explicit mode setting
        if self.mock_only and self.no_network and not self.allow_uploads:
            return RosMode.STANDBY

        # Non-STANDBY modes: use explicit ros_mode only if set to non-STANDBY
        requested = self.ros_mode.strip().upper()
        # Skip if mode is STANDBY but flags don't match (invalid state)
        if requested != "STANDBY":
            for mode in (RosMode.ACTIVE, RosMode.SANDBOX, RosMode.LIVE):
                if requested == mode.value:
                    return mode

        # Fail-closed default for non-STANDBY states
        return RosMode.SANDBOX

    def to_safe_dict(self) -> dict[str, Any]:
        # IMPORTANT: do not include any secrets here (we never read them anyway).
        return {
            "ros_mode": self.ros_mode,
            "no_network": self.no_network,
            "mock_only": self.mock_only,
            "allow_uploads": self.allow_uploads,
            "strict_phi_on_upload": self.strict_phi_on_upload,
            "max_upload_mb": self.max_upload_mb,
            "llm_provider": self.llm_provider,
            "literature_provider": self.literature_provider,
            "loaded_from": self.loaded_from,
        }

    def to_safe_json(self) -> str:
        return json.dumps(self.to_safe_dict(), indent=2, sort_keys=True)

    @staticmethod
    def from_env_and_optional_yaml(
        config_path: str | Path | None = None,
    ) -> "RuntimeConfig":
        base = RuntimeConfig()
        loaded_from = "defaults"

        cfg: Mapping[str, Any] = {}
        if config_path is not None:
            p = Path(config_path)
            if p.exists():
                cfg = _load_yaml(p)
                loaded_from = str(p)
            else:
                loaded_from = f"defaults (missing {p})"

        def _cfg_get(key: str, default: Any) -> Any:
            # accept both snake_case and SCREAMING_SNAKE
            if key in cfg:
                return cfg[key]
            alt = key.upper()
            if alt in cfg:
                return cfg[alt]
            return default

        ros_mode = str(_cfg_get("ros_mode", base.ros_mode))
        # YAML booleans are already Python bool, so we need to handle them carefully
        no_network_val = _cfg_get("no_network", base.no_network)
        if isinstance(no_network_val, bool):
            no_network = no_network_val
        else:
            no_network = _parse_bool(
                str(no_network_val) if no_network_val is not None else None,
                base.no_network,
            )
        mock_only_val = _cfg_get("mock_only", base.mock_only)
        if isinstance(mock_only_val, bool):
            mock_only = mock_only_val
        else:
            mock_only = _parse_bool(
                str(mock_only_val) if mock_only_val is not None else None,
                base.mock_only,
            )
        allow_uploads_val = _cfg_get("allow_uploads", base.allow_uploads)
        if isinstance(allow_uploads_val, bool):
            allow_uploads = allow_uploads_val
        else:
            allow_uploads = _parse_bool(
                str(allow_uploads_val) if allow_uploads_val is not None else None,
                base.allow_uploads,
            )
        strict_phi_val = _cfg_get("strict_phi_on_upload", base.strict_phi_on_upload)
        if isinstance(strict_phi_val, bool):
            strict_phi_on_upload = strict_phi_val
        else:
            strict_phi_on_upload = _parse_bool(
                str(strict_phi_val) if strict_phi_val is not None else None,
                base.strict_phi_on_upload,
            )
        max_upload_mb = int(_cfg_get("max_upload_mb", base.max_upload_mb))
        llm_provider = str(_cfg_get("llm_provider", base.llm_provider))
        literature_provider = str(
            _cfg_get("literature_provider", base.literature_provider)
        )

        # Env overrides (highest priority)
        ros_mode = os.getenv("ROS_MODE", ros_mode)
        no_network = _parse_bool(os.getenv("NO_NETWORK"), no_network)
        mock_only = _parse_bool(os.getenv("MOCK_ONLY"), mock_only)
        allow_uploads = _parse_bool(os.getenv("ALLOW_UPLOADS"), allow_uploads)
        strict_phi_on_upload = _parse_bool(
            os.getenv("STRICT_PHI_ON_UPLOAD"), strict_phi_on_upload
        )
        max_upload_mb = _parse_int(os.getenv("MAX_UPLOAD_MB"), max_upload_mb)
        llm_provider = os.getenv("LLM_PROVIDER", llm_provider)
        literature_provider = os.getenv("LITERATURE_PROVIDER", literature_provider)

        # Validate max_upload_mb is in reasonable bounds
        if max_upload_mb < 1 or max_upload_mb > 1000:
            raise ValueError(
                f"max_upload_mb must be between 1 and 1000 MB, got: {max_upload_mb}"
            )

        return RuntimeConfig(
            ros_mode=ros_mode,
            no_network=no_network,
            mock_only=mock_only,
            allow_uploads=allow_uploads,
            strict_phi_on_upload=strict_phi_on_upload,
            max_upload_mb=max_upload_mb,
            llm_provider=llm_provider,
            literature_provider=literature_provider,
            loaded_from=loaded_from,
        )
