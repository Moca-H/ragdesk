from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from app.services import kb_store, watch_store
from app.services.ingest import ingest_upload
from app.services.kb_context import set_kb_id

logger = logging.getLogger("ragdesk.watch")

ALLOWED = {".md", ".markdown", ".txt", ".pdf", ".docx", ".xlsx"}
_seen: set[str] = set()
_task: asyncio.Task | None = None


async def _ingest_file(path: Path, kb_id: str) -> None:
    key = f"{kb_id}:{path.resolve()}:{path.stat().st_mtime_ns}:{path.stat().st_size}"
    if key in _seen:
        return
    set_kb_id(kb_id)
    try:
        meta = await ingest_upload(path.name, path.read_bytes())
        _seen.add(key)
        logger.info("watched ingest ok: %s -> %s (%s)", path, meta.get("id"), kb_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("watched ingest failed %s: %s", path, exc)


async def _tick() -> None:
    cfg = watch_store.get_watch()
    if not cfg.get("enabled"):
        return
    root = watch_store.watch_dir()
    if root is None:
        return
    kb_id = str(cfg.get("kb_id") or "default")
    if not kb_store.ensure_kb_exists(kb_id):
        kb_id = "default"
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() not in ALLOWED:
            continue
        if path.name.startswith("."):
            continue
        await _ingest_file(path, kb_id)


async def _loop() -> None:
    while True:
        try:
            await _tick()
        except Exception as exc:  # noqa: BLE001
            logger.warning("watch loop error: %s", exc)
        cfg = watch_store.get_watch()
        await asyncio.sleep(int(cfg.get("poll_seconds") or 5))


def start_watcher() -> None:
    global _task
    if _task and not _task.done():
        return
    _task = asyncio.create_task(_loop())
    logger.info("folder watcher started")
