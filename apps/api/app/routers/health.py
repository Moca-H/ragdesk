from fastapi import APIRouter

from app.services import docs_meta, watch_store
from app.services.auth import configured_token, settings_locked
from app.services.providers import get_provider
from app.services.settings_store import get_settings
from app.services.vector_store import get_collection

router = APIRouter(tags=["health"])


@router.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "ragdesk-api"}


@router.get("/api/health/detail")
async def health_detail() -> dict:
    settings = get_settings()
    docs = docs_meta.load_docs()
    ready = sum(1 for d in docs if d.get("status") == "ready")
    err = sum(1 for d in docs if d.get("status") == "error")
    try:
        count = get_collection().count()
        chroma_ok = True
        chroma_error = None
    except Exception as exc:  # noqa: BLE001
        count = 0
        chroma_ok = False
        chroma_error = str(exc)

    provider_ok = True
    provider_error = None
    try:
        get_provider()
    except Exception as exc:  # noqa: BLE001
        provider_ok = False
        provider_error = str(exc)

    watch = watch_store.get_watch()
    return {
        "status": "ok" if chroma_ok and provider_ok else "degraded",
        "provider": {
            "name": settings.get("provider"),
            "ok": provider_ok,
            "error": provider_error,
            "chat_model": settings.get("chat_model"),
            "embedding_model": settings.get("embedding_model"),
        },
        "vector_store": {
            "ok": chroma_ok,
            "chunk_count": count,
            "error": chroma_error,
        },
        "documents": {
            "total": len(docs),
            "ready": ready,
            "error": err,
        },
        "watch": watch,
        "security": {
            "api_token_required": bool(configured_token()),
            "settings_locked": settings_locked(),
        },
    }
