import httpx
from openai import AsyncOpenAI

from app.services.settings_store import get_settings


async def probe_provider(settings: dict | None = None) -> dict:
    cfg = settings or get_settings()
    provider = cfg.get("provider", "mock")

    if provider == "mock":
        return {
            "provider": provider,
            "ok": True,
            "message": "Mock provider is always available",
            "base_url": "",
            "chat_models": ["mock-chat"],
            "embedding_models": ["mock-embed"],
        }

    if provider == "ollama":
        base = (cfg.get("base_url") or "http://127.0.0.1:11434").rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(f"{base}/api/tags")
                resp.raise_for_status()
                names = [
                    m.get("name")
                    for m in (resp.json().get("models") or [])
                    if m.get("name")
                ]
            return {
                "provider": provider,
                "ok": True,
                "message": f"Connected to Ollama ({len(names)} models)",
                "base_url": base,
                "chat_models": names,
                "embedding_models": names,
            }
        except Exception as exc:  # noqa: BLE001
            return {
                "provider": provider,
                "ok": False,
                "message": str(exc),
                "base_url": base,
                "chat_models": [],
                "embedding_models": [],
            }

    # openai_compat
    base = (cfg.get("base_url") or "https://api.openai.com/v1").rstrip("/")
    api_key = cfg.get("api_key") or ""
    if not api_key:
        return {
            "provider": provider,
            "ok": False,
            "message": "API key is not set",
            "base_url": base,
            "chat_models": [],
            "embedding_models": [],
        }
    try:
        client = AsyncOpenAI(api_key=api_key, base_url=base)
        listed = await client.models.list()
        names = sorted({item.id for item in listed.data if getattr(item, "id", None)})
        chat_models = [
            n
            for n in names
            if "embed" not in n.lower() and "embedding" not in n.lower()
        ]
        embedding_models = [
            n for n in names if "embed" in n.lower() or "embedding" in n.lower()
        ]
        if not chat_models:
            chat_models = names
        if not embedding_models:
            embedding_models = names
        return {
            "provider": provider,
            "ok": True,
            "message": f"Connected ({len(names)} models)",
            "base_url": base,
            "chat_models": chat_models,
            "embedding_models": embedding_models,
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "provider": provider,
            "ok": False,
            "message": str(exc),
            "base_url": base,
            "chat_models": [],
            "embedding_models": [],
        }
