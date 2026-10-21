from __future__ import annotations

from typing import Any

import chromadb

from app.paths import chroma_dir, ensure_data_dirs
from app.services.kb_context import get_kb_id

_client: Any = None


def get_client() -> Any:
    global _client
    ensure_data_dirs()
    if _client is None:
        _client = chromadb.PersistentClient(path=str(chroma_dir()))
    return _client


def collection_name(kb_id: str | None = None) -> str:
    kid = (kb_id or get_kb_id()).replace("-", "_")
    return f"ragdesk_{kid}"


def get_collection() -> Any:
    return get_client().get_or_create_collection(
        name=collection_name(),
        metadata={"hnsw:space": "cosine"},
    )


def delete_document_chunks(document_id: str) -> None:
    collection = get_collection()
    existing = collection.get(where={"document_id": document_id})
    ids = existing.get("ids") or []
    if ids:
        collection.delete(ids=ids)


def reset_collection() -> None:
    client = get_client()
    name = collection_name()
    try:
        client.delete_collection(name)
    except Exception:
        pass
    get_collection()
