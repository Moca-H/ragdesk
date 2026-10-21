from abc import ABC, abstractmethod
from collections.abc import AsyncIterator


class LLMProvider(ABC):
    @abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError

    @abstractmethod
    async def stream_chat(
        self, messages: list[dict[str, str]]
    ) -> AsyncIterator[str]:
        raise NotImplementedError
        yield  # pragma: no cover
