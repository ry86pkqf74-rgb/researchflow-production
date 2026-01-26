from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass

from src.llm.providers.base import LLMResult, LLMUsage
from src.runtime_config import RuntimeConfig


@dataclass(frozen=True)
class AnthropicProvider:
    """
    LLM provider for Anthropic Claude models via the Messages API.

    This provider is designed to be called only from the offline-governed
    runtime and never to embed API keys in the codebase. Network access is
    gated via :class:`RuntimeConfig`:

    - If ``cfg.no_network`` is true, all Anthropic requests are blocked and a
      ``RuntimeError`` is raised.
    - If ``cfg.mock_only`` is true, real Anthropic requests are also blocked
      and a ``RuntimeError`` is raised.

    Required environment variables:

    - ``ANTHROPIC_API_KEY`` (required): API key used for authentication via
      the ``x-api-key`` header. If it is not set, this provider fails closed
      by raising a ``RuntimeError`` instead of attempting a network call.
    - ``ANTHROPIC_MESSAGES_URL`` (optional): full URL for the Anthropic
      Messages API endpoint. Defaults to ``https://api.anthropic.com/v1/messages``
      when unset.
    - ``ANTHROPIC_VERSION`` (optional): API version header value. Defaults to
      ``2023-06-01`` when unset.

    Overall, the provider is configured to fail closed: when networking is
    disabled or required configuration is missing, it raises immediately
    rather than attempting to proceed with partial or unsafe settings.
    """

    name: str = "anthropic"

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
        Generate a message completion from the Anthropic API with governance-aware network gating.

        This method constructs a Messages API request using the provided prompts and model,
        sends it to the configured Anthropic endpoint, and wraps the response text and token
        usage metadata in an :class:`LLMResult`.

        Parameters
        ----------
        prompt:
            The main user prompt to send to the model.
        system_prompt:
            Optional system-level instruction that is sent as a top-level ``system`` field
            in the request body (unlike OpenAI which uses a messages array entry).
        model:
            The Anthropic model identifier to invoke (e.g., ``claude-3-5-sonnet-latest``).
        temperature:
            Sampling temperature for the model; higher values produce more diverse outputs.
        max_tokens:
            Maximum number of tokens the model is allowed to generate in the completion.

        Returns
        -------
        LLMResult
            An object containing the generated text, provider and model identifiers, usage
            information (input/output tokens when available), request id, and minimal raw
            metadata such as the stop reason.

        Raises
        ------
        RuntimeError
            If network access is gated off by runtime configuration (for example when
            ``NO_NETWORK=1`` or ``MOCK_ONLY=1`` are set, causing ``cfg.no_network`` or
            ``cfg.mock_only`` to be true), this method fails closed and does not perform
            any outbound request. Also raised if the ``ANTHROPIC_API_KEY`` environment
            variable is not set, or if the Anthropic API returns an error response.
        urllib.error.URLError
            If network connection fails (DNS resolution, connection refused, timeout).
        urllib.error.HTTPError
            If the Anthropic API returns an HTTP error status code.

        Notes
        -----
        Network behavior is controlled by :class:`RuntimeConfig` loaded from environment
        and optional YAML. When gating allows network use, this method issues an HTTPS
        POST request to the Anthropic Messages API endpoint; otherwise, it raises a
        ``RuntimeError`` without making any network call.

        Unlike the OpenAI API, Anthropic returns content as an array of blocks. This
        method filters for blocks with ``type="text"`` and concatenates their text content.
        """
        cfg = RuntimeConfig.from_env_and_optional_yaml(None)
        if cfg.no_network or cfg.mock_only:
            raise RuntimeError(
                "NO_NETWORK=1 or MOCK_ONLY=1 blocks Anthropic calls (fail-closed)."
            )

        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY not set.")

        url = os.getenv(
            "ANTHROPIC_MESSAGES_URL", "https://api.anthropic.com/v1/messages"
        )

        body: dict = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system_prompt:
            body["system"] = system_prompt

        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode("utf-8"),
            headers={
                "x-api-key": api_key,
                "anthropic-version": os.getenv("ANTHROPIC_VERSION", "2023-06-01"),
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
            raise RuntimeError(
                f"Anthropic API error (HTTP {e.code}): {error_msg}"
            ) from e
        except urllib.error.URLError as e:
            raise RuntimeError(
                f"Network error accessing Anthropic API: {e.reason}"
            ) from e
        except Exception as e:
            raise RuntimeError(f"Unexpected error calling Anthropic API: {e}") from e

        # Check for API error response (e.g., invalid key, rate limit, model not found)
        if "error" in payload:
            error_info = payload["error"]
            error_msg = error_info.get("message", "Unknown error")
            error_type = error_info.get("type", "unknown_error")
            raise RuntimeError(f"Anthropic API error ({error_type}): {error_msg}")

        # Anthropic returns content as an array of blocks
        blocks = payload.get("content") or []
        text_parts = []
        for b in blocks:
            if isinstance(b, dict) and b.get("type") == "text":
                text_parts.append(b.get("text") or "")
        text = "".join(text_parts)

        usage_p = payload.get("usage") or {}

        # Safer conversion for token counts with fallback
        def safe_int(value) -> int | None:
            if value is None:
                return None
            try:
                return int(value)
            except (ValueError, TypeError):
                return None

        usage = LLMUsage(
            input_tokens=safe_int(usage_p.get("input_tokens")),
            output_tokens=safe_int(usage_p.get("output_tokens")),
        )
        return LLMResult(
            text=text,
            provider="anthropic",
            model=model,
            usage=usage,
            request_id=payload.get("id"),
            raw_meta={"stop_reason": payload.get("stop_reason")},
        )
