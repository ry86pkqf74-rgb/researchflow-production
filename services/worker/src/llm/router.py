from __future__ import annotations

import os

from src.llm.providers.anthropic_provider import AnthropicProvider
from src.llm.providers.base import LLMResult
from src.llm.providers.mock import MockProvider
from src.llm.providers.openai_provider import OpenAIProvider
from src.llm.providers.xai_provider import XAIProvider
from src.runtime_config import RuntimeConfig


def _select_provider(name: str):
    n = name.strip().lower()
    if n == "openai":
        return OpenAIProvider()
    if n == "anthropic":
        return AnthropicProvider()
    if n == "xai":
        return XAIProvider()
    return MockProvider()


def generate_text(
    *,
    task_name: str,
    prompt: str,
    system_prompt: str | None,
    model: str,
    temperature: float = 0.2,
    max_tokens: int = 800,
) -> LLMResult:
    """
    One entry point for draft-generation or summarization calls.
    The provider is selected via:
      1) RuntimeConfig.llm_provider (env LLM_PROVIDER)
      2) fallback to env LLM_PROVIDER
      3) fallback to mock
    """
    cfg = RuntimeConfig.from_env_and_optional_yaml(None)
    provider_name = cfg.llm_provider or os.getenv("LLM_PROVIDER") or "mock"
    provider = _select_provider(provider_name)
    return provider.generate_text(
        prompt=prompt,
        system_prompt=system_prompt,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
    )
