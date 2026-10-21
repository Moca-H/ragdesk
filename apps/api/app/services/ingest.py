from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader

from app.paths import UPLOADS_DIR, ensure_data_dirs
from app.services import docs_meta
from app.services.providers import get_provider
from app.services.vector_store import (
    delete_document_chunks,
    get_collection,
    reset_collection,
)


def _read_text(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".md", ".txt", ".markdown"}:
        return path.read_text(encoding="utf-8", errors="ignore")
    if suffix == ".pdf":
        reader = PdfReader(str(path))
        parts: list[str] = []
        for page in reader.pages:
            parts.append(page.extract_text() or "")
        return "\n".join(parts).strip()
    raise ValueError(f"Unsupported file type: {suffix}")


async def _index_file(doc_id: str, filename: str, path: Path) -> tuple[int, str | None]:
    text = _read_text(path)
    if not text.strip():
        raise ValueError("Empty document content after parsing")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=120,
    )
    chunks = splitter.split_text(text)
    if not chunks:
        raise ValueError("No chunks produced")

    provider = get_provider()
    embeddings = await provider.embed(chunks)
    collection = get_collection()
    ids = [f"{doc_id}:{i}" for i in range(len(chunks))]
    metadatas = [
        {
            "document_id": doc_id,
            "filename": filename,
            "chunk_index": i,
        }
        for i in range(len(chunks))
    ]
    collection.add(
        ids=ids,
        documents=chunks,
        embeddings=embeddings,
        metadatas=metadatas,
    )
    return len(chunks), None


async def ingest_upload(filename: str, content: bytes) -> dict:
    ensure_data_dirs()
    doc_id = str(uuid4())
    safe_name = Path(filename).name
    dest = UPLOADS_DIR / f"{doc_id}__{safe_name}"
    dest.write_bytes(content)

    meta = {
        "id": doc_id,
        "filename": safe_name,
        "size": len(content),
        "status": "ready",
        "chunk_count": 0,
        "error": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "path": str(dest),
    }

    try:
        chunk_count, _ = await _index_file(doc_id, safe_name, dest)
        meta["chunk_count"] = chunk_count
        meta["status"] = "ready"
        meta["error"] = None
    except Exception as exc:  # noqa: BLE001
        meta["status"] = "error"
        meta["error"] = str(exc)
        meta["chunk_count"] = 0

    docs_meta.upsert_doc(meta)
    return meta


async def reindex_all() -> dict:
    """Clear vector store and rebuild embeddings for every stored document."""
    ensure_data_dirs()
    docs = docs_meta.load_docs()
    reset_collection()

    rebuilt = 0
    failed = 0
    updated: list[dict] = []

    for doc in docs:
        path = Path(doc.get("path") or "")
        next_doc = dict(doc)
        if not path.exists():
            next_doc["status"] = "error"
            next_doc["error"] = "Source file missing on disk"
            next_doc["chunk_count"] = 0
            failed += 1
            updated.append(next_doc)
            continue
        try:
            chunk_count, _ = await _index_file(
                next_doc["id"], next_doc["filename"], path
            )
            next_doc["chunk_count"] = chunk_count
            next_doc["status"] = "ready"
            next_doc["error"] = None
            rebuilt += 1
        except Exception as exc:  # noqa: BLE001
            next_doc["status"] = "error"
            next_doc["error"] = str(exc)
            next_doc["chunk_count"] = 0
            failed += 1
        updated.append(next_doc)

    docs_meta.save_docs(updated)
    return {
        "total": len(docs),
        "rebuilt": rebuilt,
        "failed": failed,
        "documents": updated,
    }


async def delete_document(doc_id: str) -> bool:
    found = docs_meta.remove_doc(doc_id)
    if not found:
        return False
    delete_document_chunks(doc_id)
    path = found.get("path")
    if path:
        p = Path(path)
        if p.exists():
            p.unlink()
    return True
