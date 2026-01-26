from __future__ import annotations

import hashlib
import random
from dataclasses import dataclass

from src.llm.providers.base import LLMResult, LLMUsage


@dataclass(frozen=True)
class MockProvider:
    """
    Deterministic mock provider for STANDBY/CI.
    """

    name: str = "mock"

    def generate_text(
        self,
        *,
        prompt: str,
        system_prompt: str | None = None,
        model: str = "mock-1",
        temperature: float = 0.0,
        max_tokens: int = 800,
    ) -> LLMResult:
        seed = int(
            hashlib.sha256(
                (system_prompt or "" + "\n" + prompt).encode("utf-8")
            ).hexdigest()[:8],
            16,
        )
        r = random.Random(seed)
        bullets = []
        n = max(3, min(7, r.randint(3, 7)))
        for i in range(n):
            bullets.append(
                f"- Mock output line {i+1}: {r.choice(['A', 'B', 'C'])}{r.randint(1, 999)}"
            )
        text = "\n".join(bullets)
        usage = LLMUsage(input_tokens=len(prompt) // 4, output_tokens=len(text) // 4)
        return LLMResult(
            text=text,
            provider="mock",
            model=model,
            usage=usage,
            request_id=None,
            raw_meta={"deterministic": True},
        )
