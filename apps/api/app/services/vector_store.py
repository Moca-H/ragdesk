import chromadb
from chromadb.api.models.Collection import Collection

from app.paths import CHROMA_DIR, ensure_data_dirs

COLLECTION_NAME = "ragdesk_docs"
_client: chromadb.PersistentClient | None = None


def get_client() -> chromadb.PersistentClient:
    global _client
    ensure_data_dirs()
    if _client is None:
        _client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    return _client


def get_collection() -> Collection:
    return get_client().get_or_create_collection(
        name=COLLECTION_NAME,
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
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass
    get_collection()
