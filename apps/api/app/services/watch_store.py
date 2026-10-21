from __future__ import annotations

import json
import os
from copy import deepcopy
from pathlib import Path

from app.paths import DATA_ROOT, ensure_data_dirs

WATCH_PATH = DATA_ROOT / "watch.json"

DEFAULT = {
    "enabled": False,
    "path": os.environ.get("RAGDESK_WATCH_DIR", ""),
    "kb_id": "default",
    "poll_seconds": 5,
}


def get_watch() -> dict:
    ensure_data_dirs()
    if not WATCH_PATH.exists():
        data = deepcopy(DEFAULT)
        if data["path"]:
            data["enabled"] = True
        save_watch(data)
        return data
    data = json.loads(WATCH_PATH.read_text(encoding="utf-8"))
    for k, v in DEFAULT.items():
        data.setdefault(k, v)
    return data


def save_watch(data: dict) -> dict:
    ensure_data_dirs()
    clean = {
        "enabled": bool(data.get("enabled")),
        "path": str(data.get("path") or "").strip(),
        "kb_id": str(data.get("kb_id") or "default").strip() or "default",
        "poll_seconds": max(2, min(int(data.get("poll_seconds") or 5), 120)),
    }
    WATCH_PATH.write_text(json.dumps(clean, ensure_ascii=False, indent=2), encoding="utf-8")
    return clean


def watch_dir() -> Path | None:
    cfg = get_watch()
    if not cfg.get("enabled"):
        return None
    path = str(cfg.get("path") or "").strip()
    if not path:
        return None
    p = Path(path).expanduser()
    return p if p.exists() and p.is_dir() else None
