from app.services.settings_store import get_settings

from .base import LLMProvider
from .mock import MockProvider
from .ollama import OllamaProvider
from .openai_compat import OpenAICompatProvider


def get_provider(settings: dict | None = None) -> LLMProvider:
    cfg = settings or get_settings()
    provider = cfg.get("provider", "mock")
    if provider == "openai_compat":
        return OpenAICompatProvider(
            api_key=cfg.get("api_key") or "",
            base_url=cfg.get("base_url") or "https://api.openai.com/v1",
            chat_model=cfg.get("chat_model") or "gpt-4o-mini",
            embedding_model=cfg.get("embedding_model")
            or "text-embedding-3-small",
        )
    if provider == "ollama":
        return OllamaProvider(
            base_url=cfg.get("base_url")
            or "http://127.0.0.1:11434",
            chat_model=cfg.get("chat_model") or "llama3.2",
            embedding_model=cfg.get("embedding_model") or "nomic-embed-text",
        )
    return MockProvider()
