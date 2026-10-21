from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.paths import ensure_data_dirs
from app.routers import chat, documents, health, kbs, provider, settings
from app.services import kb_store
from app.services.kb_context import set_kb_id

ensure_data_dirs()
kb_store.list_kbs()

app = FastAPI(title="ragdesk API", version="0.1.0")

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


@app.middleware("http")
async def bind_knowledge_base(request: Request, call_next):
    kb_id = request.headers.get("X-Ragdesk-KB") or "default"
    if not kb_store.ensure_kb_exists(kb_id):
        kb_id = "default"
    set_kb_id(kb_id)
    ensure_data_dirs(kb_id)
    return await call_next(request)


app.include_router(health.router)
app.include_router(settings.router)
app.include_router(provider.router)
app.include_router(kbs.router)
app.include_router(documents.router)
app.include_router(chat.router)
