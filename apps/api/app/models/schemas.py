from typing import Literal

from pydantic import BaseModel, Field

ProviderName = Literal["openai_compat", "ollama", "mock"]


class SettingsUpdate(BaseModel):
    provider: ProviderName | None = None
    base_url: str | None = None
    api_key: str | None = None
    chat_model: str | None = None
    embedding_model: str | None = None


class SettingsPublic(BaseModel):
    provider: ProviderName
    base_url: str
    chat_model: str
    embedding_model: str
    api_key_set: bool
    has_documents: bool = False
    settings_locked: bool = False
    api_token_required: bool = False


class DocumentInfo(BaseModel):
    id: str
    filename: str
    size: int
    status: Literal["ready", "error", "processing"]
    chunk_count: int = 0
    error: str | None = None
    created_at: str


class ReindexResult(BaseModel):
    total: int
    rebuilt: int
    failed: int
    documents: list[DocumentInfo]


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)
    top_k: int = Field(default=4, ge=1, le=12)
    mode: Literal["rag", "agent"] = "rag"


class Citation(BaseModel):
    document_id: str
    filename: str
    excerpt: str
    score: float | None = None
    chunk_index: int | None = None
