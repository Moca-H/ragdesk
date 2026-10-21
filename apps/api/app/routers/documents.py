from fastapi import APIRouter, File, HTTPException, UploadFile

from app.models.schemas import DocumentInfo, ReindexResult
from app.services import docs_meta
from app.services.ingest import delete_document, ingest_upload, reindex_all

router = APIRouter(tags=["documents"])

ALLOWED = {".md", ".markdown", ".txt", ".pdf"}


def _to_info(d: dict) -> DocumentInfo:
    return DocumentInfo(
        id=d["id"],
        filename=d["filename"],
        size=d["size"],
        status=d["status"],
        chunk_count=d.get("chunk_count", 0),
        error=d.get("error"),
        created_at=d["created_at"],
    )


@router.get("/api/documents", response_model=list[DocumentInfo])
async def list_documents() -> list[DocumentInfo]:
    return [_to_info(d) for d in docs_meta.load_docs()]


@router.post("/api/documents", response_model=DocumentInfo)
async def upload_document(file: UploadFile = File(...)) -> DocumentInfo:
    name = file.filename or "upload.bin"
    suffix = "." + name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if suffix not in ALLOWED:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported type. Allowed: {', '.join(sorted(ALLOWED))}",
        )
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    meta = await ingest_upload(name, content)
    return _to_info(meta)


@router.post("/api/documents/reindex", response_model=ReindexResult)
async def reindex_documents() -> ReindexResult:
    result = await reindex_all()
    return ReindexResult(
        total=result["total"],
        rebuilt=result["rebuilt"],
        failed=result["failed"],
        documents=[_to_info(d) for d in result["documents"]],
    )


@router.delete("/api/documents/{doc_id}")
async def remove_document(doc_id: str) -> dict[str, bool]:
    ok = await delete_document(doc_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"ok": True}
