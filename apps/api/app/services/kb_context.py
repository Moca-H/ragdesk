from contextvars import ContextVar

current_kb_id: ContextVar[str] = ContextVar("current_kb_id", default="default")


def get_kb_id() -> str:
    return current_kb_id.get()


def set_kb_id(kb_id: str) -> None:
    current_kb_id.set(kb_id or "default")
