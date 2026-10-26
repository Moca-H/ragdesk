import logging
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.paths import API_ROOT, ensure_data_dirs
from app.routers import chat, documents, health, kbs, provider, settings, watch
from app.services import kb_store
from app.services.auth import require_api_token
from app.services.kb_context import set_kb_id
from app.services.watcher import start_watcher

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

ensure_data_dirs()
kb_store.list_kbs()

app = FastAPI(title="ragdesk API", version="0.2.0")

_DEFAULT_CORS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
_extra_cors = [
    o.strip()
    for o in os.environ.get("RAGDESK_CORS_ORIGINS", "").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_DEFAULT_CORS + _extra_cors,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Only API routes need the token; HTML/static stay public so the UI can load.
OPEN_API_PATHS = {"/api/health"}


def resolve_static_dir() -> Path | None:
    env = os.environ.get("RAGDESK_STATIC_DIR", "").strip()
    candidates: list[Path] = []
    if env:
        candidates.append(Path(env))
    candidates.append(API_ROOT / "static")
    for path in candidates:
        if path.is_dir() and (path / "index.html").is_file():
            return path.resolve()
    return None


@app.middleware("http")
async def auth_and_bind_kb(request: Request, call_next):
    path = request.url.path
    if path.startswith("/api/") and path not in OPEN_API_PATHS:
        try:
            require_api_token(request)
        except HTTPException as exc:
            return JSONResponse(
                status_code=exc.status_code,
                content={"detail": exc.detail},
            )

    kb_id = request.headers.get("X-Ragdesk-KB") or "default"
    if not kb_store.ensure_kb_exists(kb_id):
        kb_id = "default"
    set_kb_id(kb_id)
    ensure_data_dirs(kb_id)
    return await call_next(request)


@app.on_event("startup")
async def _startup() -> None:
    start_watcher()


app.include_router(health.router)
app.include_router(settings.router)
app.include_router(provider.router)
app.include_router(kbs.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(watch.router)

_STATIC_DIR = resolve_static_dir()
if _STATIC_DIR is not None:
    assets = _STATIC_DIR / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/")
    async def spa_index() -> FileResponse:
        return FileResponse(_STATIC_DIR / "index.html")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str) -> FileResponse:
        if full_path.startswith("api/") or full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="Not Found")
        target = (_STATIC_DIR / full_path).resolve()
        try:
            target.relative_to(_STATIC_DIR)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail="Not Found") from exc
        if target.is_file():
            return FileResponse(target)
        return FileResponse(_STATIC_DIR / "index.html")
