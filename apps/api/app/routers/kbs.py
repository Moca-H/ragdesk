from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services import kb_store

router = APIRouter(tags=["knowledge-bases"])


class KbCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)


@router.get("/api/kbs")
async def list_knowledge_bases() -> list[dict]:
    return kb_store.list_kbs()


@router.post("/api/kbs")
async def create_knowledge_base(body: KbCreate) -> dict:
    return kb_store.create_kb(body.name)
