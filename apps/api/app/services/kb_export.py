from __future__ import annotations

import io
import json
import zipfile
from pathlib import Path

from app.paths import docs_meta_path, ensure_data_dirs, uploads_dir
from app.services import docs_meta, kb_store
from app.services.ingest import ingest_upload
from app.services.kb_context import set_kb_id


def export_kb_zip(kb_id: str) -> bytes:
    ensure_data_dirs(kb_id)
    set_kb_id(kb_id)
    docs = docs_meta.load_docs()
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "manifest.json",
            json.dumps({"kb_id": kb_id, "documents": docs}, ensure_ascii=False, indent=2),
        )
        up = uploads_dir(kb_id)
        for doc in docs:
            src = Path(doc.get("path") or "")
            if src.exists() and src.is_file():
                arc = f"uploads/{src.name}"
                zf.write(src, arcname=arc)
            elif up.exists():
                # fallback by id prefix
                for item in up.glob(f"{doc['id']}__*"):
                    zf.write(item, arcname=f"uploads/{item.name}")
    return buf.getvalue()


async def import_kb_zip(content: bytes, *, name: str | None = None) -> dict:
    buf = io.BytesIO(content)
    with zipfile.ZipFile(buf, "r") as zf:
        manifest = json.loads(zf.read("manifest.json").decode("utf-8"))
        kb = kb_store.create_kb(name or manifest.get("kb_name") or "导入知识库")
        set_kb_id(kb["id"])
        ensure_data_dirs(kb["id"])
        imported = 0
        for info in zf.infolist():
            if not info.filename.startswith("uploads/") or info.is_dir():
                continue
            data = zf.read(info)
            fname = Path(info.filename).name
            # strip leading uuid__ if present for display name
            display = fname.split("__", 1)[-1] if "__" in fname else fname
            await ingest_upload(display, data)
            imported += 1
    return {"kb": kb, "imported": imported}
