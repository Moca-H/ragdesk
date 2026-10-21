from __future__ import annotations

import json
import os
from typing import Any

import httpx


def api_base() -> str:
    return os.environ.get("RAGDESK_API_BASE", "http://127.0.0.1:8000").rstrip("/")


def default_kb() -> str:
    return os.environ.get("RAGDESK_KB", "default")


def _headers(kb_id: str | None = None) -> dict[str, str]:
    headers = {"X-Ragdesk-KB": kb_id or default_kb()}
    token = os.environ.get("RAGDESK_API_TOKEN", "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


class RagdeskClient:
    def __init__(self, base: str | None = None, timeout: float = 120.0) -> None:
        self.base = (base or api_base()).rstrip("/")
        self.timeout = timeout

    def health(self) -> dict[str, Any]:
        with httpx.Client(timeout=self.timeout) as client:
            r = client.get(f"{self.base}/api/health", headers=_headers())
            r.raise_for_status()
            return r.json()

    def list_kbs(self) -> list[dict[str, Any]]:
        with httpx.Client(timeout=self.timeout) as client:
            r = client.get(f"{self.base}/api/kbs", headers=_headers())
            r.raise_for_status()
            return r.json()

    def list_documents(self, kb_id: str | None = None) -> list[dict[str, Any]]:
        with httpx.Client(timeout=self.timeout) as client:
            r = client.get(
                f"{self.base}/api/documents", headers=_headers(kb_id)
            )
            r.raise_for_status()
            return r.json()

    def ingest_text(
        self,
        content: str,
        *,
        filename: str = "note.md",
        kb_id: str | None = None,
    ) -> dict[str, Any]:
        name = filename if "." in filename else f"{filename}.md"
        data = content.encode("utf-8")
        with httpx.Client(timeout=self.timeout) as client:
            r = client.post(
                f"{self.base}/api/documents",
                headers=_headers(kb_id),
                files={"file": (name, data, "text/markdown")},
            )
            r.raise_for_status()
            return r.json()

    def import_sample(self, kb_id: str | None = None) -> dict[str, Any]:
        with httpx.Client(timeout=self.timeout) as client:
            r = client.post(
                f"{self.base}/api/documents/sample",
                headers=_headers(kb_id),
            )
            r.raise_for_status()
            return r.json()

    def ask(
        self,
        question: str,
        *,
        kb_id: str | None = None,
        top_k: int = 4,
        mode: str = "rag",
    ) -> dict[str, Any]:
        payload = {
            "messages": [{"role": "user", "content": question}],
            "top_k": top_k,
            "mode": mode if mode in {"rag", "agent"} else "rag",
        }
        answer_parts: list[str] = []
        citations: list[dict[str, Any]] = []
        stages: list[str] = []

        with httpx.Client(timeout=self.timeout) as client:
            with client.stream(
                "POST",
                f"{self.base}/api/chat",
                headers={**_headers(kb_id), "Content-Type": "application/json"},
                json=payload,
            ) as r:
                r.raise_for_status()
                buffer = ""
                for chunk in r.iter_text():
                    buffer += chunk
                    while "\n\n" in buffer:
                        block, buffer = buffer.split("\n\n", 1)
                        line = next(
                            (
                                ln
                                for ln in block.split("\n")
                                if ln.startswith("data: ")
                            ),
                            None,
                        )
                        if not line:
                            continue
                        try:
                            event = json.loads(line[6:])
                        except json.JSONDecodeError:
                            continue
                        et = event.get("type")
                        if et == "stage":
                            detail = event.get("detail") or event.get("stage")
                            if detail:
                                stages.append(str(detail))
                        elif et == "citations":
                            citations = event.get("citations") or []
                        elif et == "token" and event.get("content"):
                            answer_parts.append(str(event["content"]))

        return {
            "answer": "".join(answer_parts).strip(),
            "citations": citations,
            "stages": stages,
            "kb_id": kb_id or default_kb(),
            "mode": payload["mode"],
        }
