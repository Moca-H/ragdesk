import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.paths import ensure_data_dirs
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OPEN_PATHS = {"/api/health", "/docs", "/openapi.json", "/redoc"}


@app.middleware("http")
async def auth_and_bind_kb(request: Request, call_next):
    path = request.url.path
    if path not in OPEN_PATHS and not path.startswith("/assets"):
        try:
            require_api_token(request)
        except Exception as exc:
            from fastapi import HTTPException

            if isinstance(exc, HTTPException):
                return JSONResponse(
                    status_code=exc.status_code,
                    content={"detail": exc.detail},
                )
            raise

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
