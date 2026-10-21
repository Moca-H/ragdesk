from collections.abc import AsyncIterator

from openai import AsyncOpenAI

from .base import LLMProvider


class OpenAICompatProvider(LLMProvider):
    def __init__(
        self,
        *,
        api_key: str,
        base_url: str,
        chat_model: str,
        embedding_model: str,
    ) -> None:
        self.chat_model = chat_model
        self.embedding_model = embedding_model
        self.client = AsyncOpenAI(
            api_key=api_key or "EMPTY",
            base_url=base_url or "https://api.openai.com/v1",
        )

    async def embed(self, texts: list[str]) -> list[list[float]]:
        resp = await self.client.embeddings.create(
            model=self.embedding_model,
            input=texts,
        )
        return [item.embedding for item in resp.data]

    async def stream_chat(
        self, messages: list[dict[str, str]]
    ) -> AsyncIterator[str]:
        stream = await self.client.chat.completions.create(
            model=self.chat_model,
            messages=messages,  # type: ignore[arg-type]
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                yield delta
