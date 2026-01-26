from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Iterable

from src.runtime_config import RuntimeConfig


@dataclass(frozen=True)
class PreflightIssue:
    code: str
    message: str


def collect_preflight_issues(cfg: RuntimeConfig) -> list[PreflightIssue]:
    issues: list[PreflightIssue] = []

    # Active mode (not standby) implies NO_NETWORK=0 and MOCK_ONLY=0
    if not cfg.is_standby:
        if cfg.no_network:
            issues.append(
                PreflightIssue(
                    "MODE_NO_NETWORK",
                    "Active mode (not standby) but NO_NETWORK is true.",
                )
            )
        if cfg.mock_only:
            issues.append(
                PreflightIssue(
                    "MODE_MOCK_ONLY",
                    "Active mode (not standby) but MOCK_ONLY is true.",
                )
            )

    # Upload safety
    if cfg.allow_uploads and not cfg.strict_phi_on_upload:
        issues.append(
            PreflightIssue(
                "UPLOAD_PHI_NOT_STRICT",
                "ALLOW_UPLOADS is true but STRICT_PHI_ON_UPLOAD is false (unsafe).",
            )
        )

    # Provider keys (only required if provider is selected and not mock)
    provider = cfg.llm_provider.strip().lower()
    if provider and provider != "mock":
        key_map = {
            "openai": "OPENAI_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY",
            "xai": "XAI_API_KEY",
        }
        env_key = key_map.get(provider)
        if env_key is None:
            issues.append(
                PreflightIssue(
                    "LLM_PROVIDER_UNKNOWN",
                    f"Unknown LLM provider '{provider}'. Add mapping in preflight.",
                )
            )
        else:
            if not os.getenv(env_key):
                issues.append(
                    PreflightIssue(
                        "LLM_KEY_MISSING",
                        f"LLM provider '{provider}' selected but {env_key} is not set.",
                    )
                )

    return issues


def format_issues(issues: Iterable[PreflightIssue]) -> str:
    lines = []
    for i in issues:
        lines.append(f"- [{i.code}] {i.message}")
    return "\n".join(lines)


def run_preflight(cfg: RuntimeConfig) -> int:
    issues = collect_preflight_issues(cfg)
    if issues:
        print("PRE-LIVE PREFLIGHT FAILED:")
        print(format_issues(issues))
        return 2
    print("PRE-LIVE PREFLIGHT OK (no issues found).")
    return 0
