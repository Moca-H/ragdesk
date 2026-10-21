import asyncio
import hashlib
import math
from collections.abc import AsyncIterator

from .base import LLMProvider


def _pseudo_embed(text: str, dims: int = 64) -> list[float]:
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    values: list[float] = []
    seed = digest
    while len(values) < dims:
        for b in seed:
            values.append((b / 255.0) * 2 - 1)
            if len(values) >= dims:
                break
        seed = hashlib.sha256(seed).digest()
    norm = math.sqrt(sum(v * v for v in values)) or 1.0
    return [v / norm for v in values]


class MockProvider(LLMProvider):
    async def embed(self, texts: list[str]) -> list[list[float]]:
        return [_pseudo_embed(t) for t in texts]

    async def stream_chat(
        self, messages: list[dict[str, str]]
    ) -> AsyncIterator[str]:
        user = next(
            (m["content"] for m in reversed(messages) if m["role"] == "user"),
            "",
        )
        context = next(
            (m["content"] for m in messages if m["role"] == "system"),
            "",
        )
        reply = (
            "【Mock Provider】未配置真实模型时的演示回复。\n\n"
            f"你的问题：{user[:200]}\n\n"
            "根据检索到的资料，简要回答如下：请在设置中切换到 "
            "OpenAI 兼容 API 或 Ollama 以获得真实生成结果。"
        )
        if "来源" in context or "Source" in context or "excerpt" in context.lower():
            reply += "\n\n（已注入检索上下文，真实 Provider 会据此作答。）"
        for ch in reply:
            await asyncio.sleep(0.008)
            yield ch
