import json
import shutil
from uuid import uuid4

from app.paths import DATA_ROOT, KBS_PATH, docs_meta_path, ensure_data_dirs, uploads_dir

DEFAULT = {"id": "default", "name": "默认知识库"}


def _migrate_legacy() -> None:
    """Move pre-kb documents into the default knowledge base once."""
    old_docs = DATA_ROOT / "documents.json"
    old_uploads = DATA_ROOT / "uploads"
    target_docs = docs_meta_path("default")
    if old_docs.exists() and not target_docs.exists():
        ensure_data_dirs("default")
        shutil.copy2(old_docs, target_docs)
    if old_uploads.exists():
        dest = uploads_dir("default")
        dest.mkdir(parents=True, exist_ok=True)
        for item in old_uploads.iterdir():
            target = dest / item.name
            if item.is_file() and not target.exists():
                shutil.copy2(item, target)


def _read() -> list[dict]:
    ensure_data_dirs()
    _migrate_legacy()
    if not KBS_PATH.exists():
        _write([DEFAULT])
        return [DEFAULT]
    data = json.loads(KBS_PATH.read_text(encoding="utf-8"))
    if not data:
        _write([DEFAULT])
        return [DEFAULT]
    return data


def _write(items: list[dict]) -> None:
    ensure_data_dirs()
    KBS_PATH.write_text(
        json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def list_kbs() -> list[dict]:
    return _read()


def create_kb(name: str) -> dict:
    items = _read()
    kb = {"id": str(uuid4())[:8], "name": name.strip() or "未命名知识库"}
    items.append(kb)
    _write(items)
    ensure_data_dirs(kb["id"])
    return kb


def rename_kb(kb_id: str, name: str) -> dict | None:
    items = _read()
    for item in items:
        if item["id"] == kb_id:
            item["name"] = name.strip() or item["name"]
            _write(items)
            return item
    return None


def ensure_kb_exists(kb_id: str) -> bool:
    return any(item["id"] == kb_id for item in _read())
