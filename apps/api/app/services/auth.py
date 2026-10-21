import os
import secrets

from fastapi import HTTPException, Request


def configured_token() -> str:
    return os.environ.get("RAGDESK_API_TOKEN", "").strip()


def settings_locked() -> bool:
    return os.environ.get("RAGDESK_LOCK_SETTINGS", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def extract_token(request: Request) -> str:
    auth = request.headers.get("Authorization") or ""
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return (request.headers.get("X-Ragdesk-Token") or "").strip()


def require_api_token(request: Request) -> None:
    expected = configured_token()
    if not expected:
        return
    got = extract_token(request)
    if not got or not secrets.compare_digest(got, expected):
        raise HTTPException(status_code=401, detail="未授权：需要有效的 API Token")
