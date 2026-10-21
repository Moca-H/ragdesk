#!/usr/bin/env python3
"""Minimal ragdesk CLI: ask / ingest / health."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import httpx

DEFAULT_BASE = os.environ.get("RAGDESK_API_BASE", "http://127.0.0.1:8000").rstrip("/")


def headers(kb: str) -> dict[str, str]:
    h = {"X-Ragdesk-KB": kb}
    token = os.environ.get("RAGDESK_API_TOKEN", "").strip()
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def cmd_health(base: str, kb: str) -> int:
    r = httpx.get(f"{base}/api/health/detail", headers=headers(kb), timeout=30)
    r.raise_for_status()
    print(json.dumps(r.json(), ensure_ascii=False, indent=2))
    return 0


def cmd_ingest(base: str, kb: str, path: Path) -> int:
    data = path.read_bytes()
    r = httpx.post(
        f"{base}/api/documents",
        headers=headers(kb),
        files={"file": (path.name, data)},
        timeout=120,
    )
    r.raise_for_status()
    print(json.dumps(r.json(), ensure_ascii=False, indent=2))
    return 0


def cmd_ask(base: str, kb: str, question: str, mode: str) -> int:
    with httpx.stream(
        "POST",
        f"{base}/api/chat",
        headers={**headers(kb), "Content-Type": "application/json"},
        json={
            "messages": [{"role": "user", "content": question}],
            "top_k": 4,
            "mode": mode,
        },
        timeout=120,
    ) as r:
        r.raise_for_status()
        buf = ""
        answer = []
        for chunk in r.iter_text():
            buf += chunk
            while "\n\n" in buf:
                block, buf = buf.split("\n\n", 1)
                line = next((ln for ln in block.split("\n") if ln.startswith("data: ")), None)
                if not line:
                    continue
                event = json.loads(line[6:])
                if event.get("type") == "token" and event.get("content"):
                    answer.append(event["content"])
                    print(event["content"], end="", flush=True)
                if event.get("type") == "citations":
                    cites = event.get("citations") or []
                    if cites:
                        print("\n\n--- citations ---", flush=True)
                        for c in cites:
                            print(f"- {c.get('filename')} #{c.get('chunk_index')}", flush=True)
        print()
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="ragdesk", description="ragdesk CLI")
    p.add_argument("--base", default=DEFAULT_BASE)
    p.add_argument("--kb", default=os.environ.get("RAGDESK_KB", "default"))
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("health", help="show health detail")

    ing = sub.add_parser("ingest", help="upload a file")
    ing.add_argument("path", type=Path)

    ask = sub.add_parser("ask", help="ask a question")
    ask.add_argument("question")
    ask.add_argument("--mode", choices=["rag", "agent"], default="rag")

    args = p.parse_args(argv)
    try:
        if args.cmd == "health":
            return cmd_health(args.base, args.kb)
        if args.cmd == "ingest":
            return cmd_ingest(args.base, args.kb, args.path)
        if args.cmd == "ask":
            return cmd_ask(args.base, args.kb, args.question, args.mode)
    except httpx.HTTPError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
