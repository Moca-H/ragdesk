import json
from typing import Any

from app.paths import DOCS_META_PATH, ensure_data_dirs


def load_docs() -> list[dict[str, Any]]:
    ensure_data_dirs()
    if not DOCS_META_PATH.exists():
        return []
    return json.loads(DOCS_META_PATH.read_text(encoding="utf-8"))


def save_docs(docs: list[dict[str, Any]]) -> None:
    ensure_data_dirs()
    DOCS_META_PATH.write_text(
        json.dumps(docs, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def upsert_doc(doc: dict[str, Any]) -> None:
    docs = load_docs()
    docs = [d for d in docs if d["id"] != doc["id"]]
    docs.insert(0, doc)
    save_docs(docs)


def remove_doc(doc_id: str) -> dict[str, Any] | None:
    docs = load_docs()
    found = next((d for d in docs if d["id"] == doc_id), None)
    save_docs([d for d in docs if d["id"] != doc_id])
    return found
