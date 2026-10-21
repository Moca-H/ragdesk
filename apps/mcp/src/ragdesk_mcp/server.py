from __future__ import annotations

import json

from mcp.server.fastmcp import FastMCP

from ragdesk_mcp.client import RagdeskClient, api_base, default_kb

mcp = FastMCP(
    "ragdesk",
    instructions=(
        "Tools for the local ragdesk RAG API. "
        "Point RAGDESK_API_BASE at a running ragdesk server "
        "(default http://127.0.0.1:8000)."
    ),
)


def _client() -> RagdeskClient:
    return RagdeskClient()


@mcp.tool()
def ragdesk_health() -> str:
    """Check whether the ragdesk API is reachable."""
    try:
        data = _client().health()
        return json.dumps(
            {"ok": True, "api_base": api_base(), "health": data},
            ensure_ascii=False,
        )
    except Exception as exc:  # noqa: BLE001
        return json.dumps(
            {"ok": False, "api_base": api_base(), "error": str(exc)},
            ensure_ascii=False,
        )


@mcp.tool()
def list_knowledge_bases() -> str:
    """List ragdesk knowledge bases (id + name)."""
    items = _client().list_kbs()
    return json.dumps(items, ensure_ascii=False, indent=2)


@mcp.tool()
def list_documents(kb_id: str = "") -> str:
    """List documents in a knowledge base. Empty kb_id uses RAGDESK_KB / default."""
    kid = kb_id.strip() or None
    docs = _client().list_documents(kid)
    return json.dumps(docs, ensure_ascii=False, indent=2)


@mcp.tool()
def ingest_text(content: str, filename: str = "note.md", kb_id: str = "") -> str:
    """Ingest plain/markdown text into a knowledge base as a new document."""
    if not content.strip():
        return json.dumps({"ok": False, "error": "content is empty"}, ensure_ascii=False)
    kid = kb_id.strip() or None
    meta = _client().ingest_text(content, filename=filename or "note.md", kb_id=kid)
    return json.dumps({"ok": True, "document": meta}, ensure_ascii=False, indent=2)


@mcp.tool()
def import_sample(kb_id: str = "") -> str:
    """Import the built-in welcome sample document into a knowledge base."""
    kid = kb_id.strip() or None
    meta = _client().import_sample(kid)
    return json.dumps({"ok": True, "document": meta}, ensure_ascii=False, indent=2)


@mcp.tool()
def ask(
    question: str,
    kb_id: str = "",
    top_k: int = 4,
    mode: str = "rag",
) -> str:
    """Ask the ragdesk knowledge base. mode is 'rag' or 'agent'. Returns answer + citations."""
    if not question.strip():
        return json.dumps({"ok": False, "error": "question is empty"}, ensure_ascii=False)
    kid = kb_id.strip() or None
    k = max(1, min(int(top_k or 4), 12))
    result = _client().ask(question, kb_id=kid, top_k=k, mode=mode or "rag")
    return json.dumps({"ok": True, **result}, ensure_ascii=False, indent=2)


def main() -> None:
    # Stdio transport for Cursor / Claude Desktop / uvx.
    mcp.run()


if __name__ == "__main__":
    main()
