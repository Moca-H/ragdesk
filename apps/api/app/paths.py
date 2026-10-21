from pathlib import Path

API_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = API_ROOT / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
CHROMA_DIR = DATA_DIR / "chroma"
CONFIG_PATH = DATA_DIR / "config.json"
DOCS_META_PATH = DATA_DIR / "documents.json"


def ensure_data_dirs() -> None:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
