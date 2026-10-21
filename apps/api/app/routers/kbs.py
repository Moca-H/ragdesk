from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.services import kb_export, kb_store

router = APIRouter(tags=["knowledge-bases"])


class KbCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    readonly: bool = False


class KbReadonly(BaseModel):
    readonly: bool


@router.get("/api/kbs")
async def list_knowledge_bases() -> list[dict]:
    return kb_store.list_kbs()


@router.post("/api/kbs")
async def create_knowledge_base(body: KbCreate) -> dict:
    return kb_store.create_kb(body.name, readonly=body.readonly)


@router.patch("/api/kbs/{kb_id}/readonly")
async def patch_kb_readonly(kb_id: str, body: KbReadonly) -> dict:
    item = kb_store.set_readonly(kb_id, body.readonly)
    if not item:
        raise HTTPException(status_code=404, detail="知识库不存在")
    return item


@router.get("/api/kbs/{kb_id}/export")
async def export_knowledge_base(kb_id: str) -> Response:
    if not kb_store.ensure_kb_exists(kb_id):
        raise HTTPException(status_code=404, detail="知识库不存在")
    data = kb_export.export_kb_zip(kb_id)
    return Response(
        content=data,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="ragdesk-{kb_id}.zip"'
        },
    )


@router.post("/api/kbs/import")
async def import_knowledge_base(
    file: UploadFile = File(...),
    name: str | None = None,
) -> dict:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="文件为空")
    try:
        return await kb_export.import_kb_zip(content, name=name)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"导入失败：{exc}") from exc
