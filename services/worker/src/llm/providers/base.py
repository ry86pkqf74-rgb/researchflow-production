from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class LLMUsage:
    input_tokens: int | None = None
    output_tokens: int | None = None


@dataclass(frozen=True)
class LLMResult:
    text: str
    provider: str
    model: str
    usage: LLMUsage = LLMUsage()
    request_id: str | None = None
    raw_meta: dict[str, Any] | None = None


class LLMProvider(Protocol):
    name: str

    def generate_text(
        self,
        *,
        prompt: str,
        system_prompt: str | None = None,
        model: str,
        temperature: float = 0.2,
        max_tokens: int = 800,
    ) -> LLMResult: ...
