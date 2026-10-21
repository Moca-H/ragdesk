import asyncio
import json
from collections.abc import AsyncIterator, Awaitable, Callable
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader

from app.paths import API_ROOT, ensure_data_dirs, uploads_dir
from app.services import docs_meta
from app.services.providers import get_provider
from app.services.vector_store import (
    delete_document_chunks,
    get_collection,
    reset_collection,
)

EmitFn = Callable[[str], Awaitable[None]]


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


def _stage(name: str, **extra) -> str:
    payload = {"type": "stage", "stage": name, **extra}
    return json.dumps(payload, ensure_ascii=False)


async def _index_file(
    doc_id: str,
    filename: str,
    path: Path,
    *,
    emit: EmitFn | None = None,
) -> int:
    if emit:
        await emit(_stage("parsing", detail="正在解析文件"))
    text = _read_text(path)
    if not text.strip():
        raise ValueError("解析后内容为空，请检查文件是否为可读文本/PDF")

    if emit:
        await emit(_stage("chunking", detail="正在切分文本"))
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=120,
    )
    chunks = splitter.split_text(text)
    if not chunks:
        raise ValueError("切分后没有可用片段")

    if emit:
        await emit(
            _stage(
                "embedding",
                detail=f"正在向量化 {len(chunks)} 个片段",
                chunk_count=len(chunks),
            )
        )
    provider = get_provider()
    embeddings = await provider.embed(chunks)
    collection = get_collection()
    ids = [f"{doc_id}:{i}" for i in range(len(chunks))]
    metadatas = [
        {
            "document_id": doc_id,
            "filename": filename,
            "chunk_index": i,
            "excerpt": chunks[i][:2000],
        }
        for i in range(len(chunks))
    ]
    if emit:
        await emit(_stage("storing", detail="写入向量库"))
    collection.add(
        ids=ids,
        documents=chunks,
        embeddings=embeddings,
        metadatas=metadatas,
    )
    return len(chunks)


async def ingest_upload(filename: str, content: bytes) -> dict:
    ensure_data_dirs()
    doc_id = str(uuid4())
    safe_name = Path(filename).name
    dest = uploads_dir() / f"{doc_id}__{safe_name}"
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
        meta["chunk_count"] = await _index_file(doc_id, safe_name, dest)
        meta["status"] = "ready"
        meta["error"] = None
    except Exception as exc:  # noqa: BLE001
        meta["status"] = "error"
        meta["error"] = str(exc)
        meta["chunk_count"] = 0
    docs_meta.upsert_doc(meta)
    return meta


async def ingest_upload_stream(
    filename: str, content: bytes
) -> AsyncIterator[str]:
    ensure_data_dirs()
    doc_id = str(uuid4())
    safe_name = Path(filename).name
    dest = uploads_dir() / f"{doc_id}__{safe_name}"

    yield _stage("saving", detail="保存上传文件")
    dest.write_bytes(content)

    meta = {
        "id": doc_id,
        "filename": safe_name,
        "size": len(content),
        "status": "processing",
        "chunk_count": 0,
        "error": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "path": str(dest),
    }
    docs_meta.upsert_doc(meta)

    queue: asyncio.Queue[str | None] = asyncio.Queue()

    async def emit(line: str) -> None:
        await queue.put(line)

    async def worker() -> None:
        try:
            chunk_count = await _index_file(
                doc_id, safe_name, dest, emit=emit
            )
            meta["chunk_count"] = chunk_count
            meta["status"] = "ready"
            meta["error"] = None
            docs_meta.upsert_doc(meta)
            await queue.put(
                json.dumps(
                    {"type": "done", "document": meta},
                    ensure_ascii=False,
                )
            )
        except Exception as exc:  # noqa: BLE001
            meta["status"] = "error"
            meta["error"] = str(exc)
            meta["chunk_count"] = 0
            docs_meta.upsert_doc(meta)
            await queue.put(
                json.dumps(
                    {
                        "type": "error",
                        "message": str(exc),
                        "document": meta,
                    },
                    ensure_ascii=False,
                )
            )
        finally:
            await queue.put(None)

    task = asyncio.create_task(worker())
    while True:
        item = await queue.get()
        if item is None:
            break
        yield item
    await task


async def import_sample() -> dict:
    sample = API_ROOT / "sample" / "welcome.md"
    if not sample.exists():
        raise FileNotFoundError("找不到示例文件 sample/welcome.md")
    return await ingest_upload(sample.name, sample.read_bytes())


async def reindex_all() -> dict:
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
            next_doc["error"] = "磁盘上找不到源文件，请重新上传"
            next_doc["chunk_count"] = 0
            failed += 1
            updated.append(next_doc)
            continue
        try:
            chunk_count = await _index_file(
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
