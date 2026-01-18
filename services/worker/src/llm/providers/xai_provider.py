from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass

from src.llm.providers.base import LLMResult, LLMUsage
from src.runtime_config import RuntimeConfig


def _safe_int(value) -> int | None:
    """Safely convert a value to int, returning None if conversion fails."""
    if value is None:
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


@dataclass(frozen=True)
class XAIProvider:
    """
    LLM provider for xAI-compatible chat completion models (OpenAI-compatible endpoint).

    This provider is designed to be called only from the offline-governed
    runtime and never to embed API keys in the codebase. Network access is
    gated via :class:`RuntimeConfig`:

    - If ``cfg.no_network`` is true, all xAI requests are blocked and a
      ``RuntimeError`` is raised.
    - If ``cfg.mock_only`` is true, real xAI requests are also blocked
      and a ``RuntimeError`` is raised.

    Required environment variables:

    - ``XAI_API_KEY`` (required): bearer token used for authentication.
      If it is not set, this provider fails closed by raising a
      ``RuntimeError`` instead of attempting a network call.
    - ``XAI_BASE_URL`` (required): base URL for the xAI-compatible API
      (e.g., ``https://api.x.ai/v1``). This is intentionally required
      rather than defaulted to avoid hardcoding a potentially changing endpoint.

    Overall, the provider is configured to fail closed: when networking is
    disabled or required configuration is missing, it raises immediately
    rather than attempting to proceed with partial or unsafe settings.
    """

    name: str = "xai"

    def generate_text(
        self,
        *,
        prompt: str,
        system_prompt: str | None = None,
        model: str,
        temperature: float = 0.2,
        max_tokens: int = 800,
    ) -> LLMResult:
        """
        Generate a chat completion from the xAI API with governance-aware network gating.

        This method constructs a chat-completions request using the provided prompts and model,
        sends it to the configured xAI endpoint, and wraps the response text and token usage
        metadata in an :class:`LLMResult`.

        Parameters
        ----------
        prompt:
            The main user prompt to send to the model.
        system_prompt:
            Optional system-level instruction that is prepended as a separate message if provided.
        model:
            The xAI chat model identifier to invoke (e.g., ``grok-2``).
        temperature:
            Sampling temperature for the model; higher values produce more diverse outputs.
        max_tokens:
            Maximum number of tokens the model is allowed to generate in the completion.

        Returns
        -------
        LLMResult
            An object containing the generated text, provider and model identifiers, usage
            information (input/output tokens when available), request id, and minimal raw
            metadata such as the finish reason.

        Raises
        ------
        RuntimeError
            If network access is gated off by runtime configuration (for example when
            ``NO_NETWORK=1`` or ``MOCK_ONLY=1`` are set, causing ``cfg.no_network`` or
            ``cfg.mock_only`` to be true), this method fails closed and does not perform
            any outbound request. Also raised if the ``XAI_API_KEY`` or ``XAI_BASE_URL``
            environment variables are not set, or if the xAI API returns an error response.
        urllib.error.URLError
            If network connection fails (DNS resolution, connection refused, timeout).
        urllib.error.HTTPError
            If the xAI API returns an HTTP error status code.

        Notes
        -----
        Network behavior is controlled by :class:`RuntimeConfig` loaded from environment
        and optional YAML. When gating allows network use, this method issues an HTTPS
        POST request to the xAI ``/chat/completions`` endpoint using the configured
        base URL; otherwise, it raises a ``RuntimeError`` without making any network call.
        """
        cfg = RuntimeConfig.from_env_and_optional_yaml(None)
        if cfg.no_network or cfg.mock_only:
            raise RuntimeError(
                "NO_NETWORK=1 or MOCK_ONLY=1 blocks xAI calls (fail-closed)."
            )

        api_key = os.getenv("XAI_API_KEY")
        if not api_key:
            raise RuntimeError("XAI_API_KEY not set.")

        base_url = os.getenv("XAI_BASE_URL")
        if not base_url:
            raise RuntimeError("XAI_BASE_URL not set (e.g. https://api.x.ai/v1).")
        url = base_url.rstrip("/") + "/chat/completions"

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        body = {
            "model": model,
            "messages": messages,
            "temperature": float(temperature),
            "max_tokens": int(max_tokens),
        }

        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                raw = resp.read().decode("utf-8")
                payload = json.loads(raw)
        except urllib.error.HTTPError as e:
            # Read error response body if available
            error_body = e.read().decode("utf-8") if e.fp else ""
            try:
                error_data = json.loads(error_body) if error_body else {}
                error_msg = error_data.get("error", {}).get("message", str(e))
            except json.JSONDecodeError:
                error_msg = f"{e}: {error_body[:200]}"
            raise RuntimeError(f"xAI API error (HTTP {e.code}): {error_msg}") from e
        except urllib.error.URLError as e:
            raise RuntimeError(f"Network error accessing xAI API: {e.reason}") from e
        except Exception as e:
            raise RuntimeError(f"Unexpected error calling xAI API: {e}") from e

        # Check for API error response (e.g., invalid key, rate limit, model not found)
        if "error" in payload:
            error_info = payload["error"]
            error_msg = error_info.get("message", "Unknown error")
            error_type = error_info.get("type", "unknown_error")
            raise RuntimeError(f"xAI API error ({error_type}): {error_msg}")

        text = (
            payload.get("choices", [{}])[0].get("message", {}).get("content", "")
        ) or ""
        usage_p = payload.get("usage") or {}

        usage = LLMUsage(
            input_tokens=_safe_int(usage_p.get("prompt_tokens")),
            output_tokens=_safe_int(usage_p.get("completion_tokens")),
        )
        return LLMResult(
            text=text,
            provider="xai",
            model=model,
            usage=usage,
            request_id=payload.get("id"),
            raw_meta={
                "finish_reason": payload.get("choices", [{}])[0].get("finish_reason")
            },
        )
