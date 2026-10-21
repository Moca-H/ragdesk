from pathlib import Path

from app.services.kb_context import get_kb_id

API_ROOT = Path(__file__).resolve().parent.parent
DATA_ROOT = API_ROOT / "data"
KBS_PATH = DATA_ROOT / "knowledge_bases.json"


def kb_dir(kb_id: str | None = None) -> Path:
    kid = kb_id or get_kb_id()
    return DATA_ROOT / "kbs" / kid


def uploads_dir(kb_id: str | None = None) -> Path:
    return kb_dir(kb_id) / "uploads"


def docs_meta_path(kb_id: str | None = None) -> Path:
    return kb_dir(kb_id) / "documents.json"


def chroma_dir() -> Path:
    return DATA_ROOT / "chroma"


def ensure_data_dirs(kb_id: str | None = None) -> None:
    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    chroma_dir().mkdir(parents=True, exist_ok=True)
    d = kb_dir(kb_id)
    d.mkdir(parents=True, exist_ok=True)
    uploads_dir(kb_id).mkdir(parents=True, exist_ok=True)


# Back-compat aliases used by older modules
DATA_DIR = DATA_ROOT
UPLOADS_DIR = uploads_dir()  # evaluated at import — avoid; use uploads_dir()
CHROMA_DIR = chroma_dir()
CONFIG_PATH = DATA_ROOT / "config.json"
DOCS_META_PATH = docs_meta_path()  # avoid relying on this at runtime
