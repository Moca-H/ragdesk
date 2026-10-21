from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.paths import ensure_data_dirs
from app.routers import chat, documents, health, provider, settings

ensure_data_dirs()

app = FastAPI(title="ragdesk API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(settings.router)
app.include_router(provider.router)
app.include_router(documents.router)
app.include_router(chat.router)
