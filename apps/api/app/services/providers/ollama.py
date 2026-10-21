from collections.abc import AsyncIterator

import httpx

from .base import LLMProvider


class OllamaProvider(LLMProvider):
    def __init__(
        self,
        *,
        base_url: str,
        chat_model: str,
        embedding_model: str,
    ) -> None:
        self.base_url = (base_url or "http://127.0.0.1:11434").rstrip("/")
        self.chat_model = chat_model
        self.embedding_model = embedding_model

    async def embed(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        async with httpx.AsyncClient(timeout=120.0) as client:
            for text in texts:
                resp = await client.post(
                    f"{self.base_url}/api/embeddings",
                    json={"model": self.embedding_model, "prompt": text},
                )
                resp.raise_for_status()
                data = resp.json()
                vectors.append(data["embedding"])
        return vectors

    async def stream_chat(
        self, messages: list[dict[str, str]]
    ) -> AsyncIterator[str]:
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json={
                    "model": self.chat_model,
                    "messages": messages,
                    "stream": True,
                },
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    import json

                    payload = json.loads(line)
                    msg = payload.get("message") or {}
                    content = msg.get("content")
                    if content:
                        yield content
                    if payload.get("done"):
                        break
