from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services import watch_store

router = APIRouter(tags=["watch"])


class WatchUpdate(BaseModel):
    enabled: bool | None = None
    path: str | None = None
    kb_id: str | None = None
    poll_seconds: int | None = Field(default=None, ge=2, le=120)


@router.get("/api/watch")
async def get_watch_config() -> dict:
    return watch_store.get_watch()


@router.put("/api/watch")
async def put_watch_config(body: WatchUpdate) -> dict:
    data = watch_store.get_watch()
    patch = body.model_dump(exclude_unset=True)
    data.update(patch)
    return watch_store.save_watch(data)
