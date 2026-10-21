from fastapi import APIRouter, HTTPException

from app.models.schemas import SettingsPublic, SettingsUpdate
from app.services.settings_store import get_settings, to_public, update_settings

router = APIRouter(tags=["settings"])


@router.get("/api/settings", response_model=SettingsPublic)
async def read_settings() -> SettingsPublic:
    return to_public(get_settings())


@router.put("/api/settings", response_model=SettingsPublic)
async def put_settings(body: SettingsUpdate) -> SettingsPublic:
    try:
        data = update_settings(body)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return to_public(data)
