#!/usr/bin/env python3
"""Lightweight Windows tray helper: open UI + quick ask dialog."""
from __future__ import annotations

import json
import os
import threading
import webbrowser
from tkinter import simpledialog
import tkinter as tk

import httpx

try:
    import pystray
    from PIL import Image, ImageDraw
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "请先安装: pip install pystray pillow\n" + str(exc)
    ) from exc

BASE = os.environ.get("RAGDESK_API_BASE", "http://127.0.0.1:8000").rstrip("/")
WEB = os.environ.get("RAGDESK_WEB_URL", "http://127.0.0.1:5173")
KB = os.environ.get("RAGDESK_KB", "default")


def _headers() -> dict[str, str]:
    h = {"X-Ragdesk-KB": KB, "Content-Type": "application/json"}
    token = os.environ.get("RAGDESK_API_TOKEN", "").strip()
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def _icon_image():
    img = Image.new("RGB", (64, 64), "#1c1a18")
    d = ImageDraw.Draw(img)
    d.ellipse((12, 12, 52, 52), fill="#b08d57")
    return img


def open_ui(icon=None, item=None):  # noqa: ANN001
    webbrowser.open(WEB)


def quick_ask(icon=None, item=None):  # noqa: ANN001
    root = tk.Tk()
    root.withdraw()
    q = simpledialog.askstring("ragdesk", "问知识库：", parent=root)
    root.destroy()
    if not q:
        return

    def worker():
        try:
            answer = []
            with httpx.stream(
                "POST",
                f"{BASE}/api/chat",
                headers=_headers(),
                json={
                    "messages": [{"role": "user", "content": q}],
                    "top_k": 4,
                    "mode": "rag",
                },
                timeout=120,
            ) as r:
                r.raise_for_status()
                buf = ""
                for chunk in r.iter_text():
                    buf += chunk
                    while "\n\n" in buf:
                        block, buf = buf.split("\n\n", 1)
                        line = next(
                            (ln for ln in block.split("\n") if ln.startswith("data: ")),
                            None,
                        )
                        if not line:
                            continue
                        event = json.loads(line[6:])
                        if event.get("type") == "token" and event.get("content"):
                            answer.append(event["content"])
            text = "".join(answer) or "(无回答)"
        except Exception as exc:  # noqa: BLE001
            text = f"失败：{exc}"
        ui = tk.Tk()
        ui.title("ragdesk 回答")
        box = tk.Text(ui, width=72, height=18, wrap="word")
        box.pack(fill="both", expand=True, padx=8, pady=8)
        box.insert("1.0", text)
        box.config(state="disabled")
        ui.mainloop()

    threading.Thread(target=worker, daemon=True).start()


def quit_app(icon, item):  # noqa: ANN001
    icon.stop()


def main() -> None:
    menu = pystray.Menu(
        pystray.MenuItem("打开界面", open_ui, default=True),
        pystray.MenuItem("快速提问", quick_ask),
        pystray.MenuItem("退出", quit_app),
    )
    icon = pystray.Icon("ragdesk", _icon_image(), "ragdesk", menu)
    icon.run()


if __name__ == "__main__":
    main()
