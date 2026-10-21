from fastapi import APIRouter

from app.services.provider_probe import probe_provider

router = APIRouter(tags=["provider"])


@router.get("/api/provider/status")
async def provider_status() -> dict:
    return await probe_provider()
