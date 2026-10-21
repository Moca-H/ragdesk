import json
import os
from copy import deepcopy

from dotenv import load_dotenv

from app.models.schemas import SettingsPublic, SettingsUpdate
from app.paths import CONFIG_PATH, ensure_data_dirs
from app.services import docs_meta

load_dotenv()

DEFAULTS = {
    "provider": os.getenv("RAGDESK_PROVIDER", "mock"),
    "base_url": os.getenv("RAGDESK_BASE_URL", ""),
    "api_key": os.getenv("RAGDESK_API_KEY", ""),
    "chat_model": os.getenv("RAGDESK_CHAT_MODEL", "gpt-4o-mini"),
    "embedding_model": os.getenv(
        "RAGDESK_EMBEDDING_MODEL", "text-embedding-3-small"
    ),
}


def _read_raw() -> dict:
    ensure_data_dirs()
    if not CONFIG_PATH.exists():
        data = deepcopy(DEFAULTS)
        _write_raw(data)
        return data
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def _write_raw(data: dict) -> None:
    ensure_data_dirs()
    CONFIG_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def get_settings() -> dict:
    data = _read_raw()
    for key, value in DEFAULTS.items():
        data.setdefault(key, value)
    if data.get("provider") == "ollama" and not data.get("base_url"):
        data["base_url"] = os.getenv(
            "RAGDESK_OLLAMA_BASE_URL", "http://127.0.0.1:11434"
        )
    return data


def update_settings(patch: SettingsUpdate) -> dict:
    from app.services.auth import settings_locked

    if settings_locked():
        raise PermissionError("设置已由服务端环境变量锁定，无法在界面修改")
    data = get_settings()
    payload = patch.model_dump(exclude_unset=True)
    for key, value in payload.items():
        if value is None:
            continue
        if key == "api_key" and value == "":
            continue
        data[key] = value
    if data.get("provider") == "ollama" and not data.get("base_url"):
        data["base_url"] = os.getenv(
            "RAGDESK_OLLAMA_BASE_URL", "http://127.0.0.1:11434"
        )
    if data.get("provider") == "openai_compat" and not data.get("base_url"):
        data["base_url"] = "https://api.openai.com/v1"
    _write_raw(data)
    return data


def _has_documents() -> bool:
    try:
        return bool(docs_meta.load_docs())
    except Exception:
        return False


def to_public(data: dict | None = None) -> SettingsPublic:
    from app.services.auth import configured_token, settings_locked

    raw = data or get_settings()
    return SettingsPublic(
        provider=raw["provider"],
        base_url=raw.get("base_url") or "",
        chat_model=raw.get("chat_model") or "",
        embedding_model=raw.get("embedding_model") or "",
        api_key_set=bool(raw.get("api_key")),
        has_documents=_has_documents(),
        settings_locked=settings_locked(),
        api_token_required=bool(configured_token()),
    )
