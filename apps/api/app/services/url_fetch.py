from __future__ import annotations

import re
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._skip = 0
        self.parts: list[str] = []
        self.title = ""

    def handle_starttag(self, tag: str, attrs) -> None:  # noqa: ANN001
        if tag in {"script", "style", "noscript"}:
            self._skip += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript"} and self._skip:
            self._skip -= 1

    def handle_data(self, data: str) -> None:
        if self._skip:
            return
        text = data.strip()
        if text:
            self.parts.append(text)


async def fetch_url_text(url: str) -> tuple[str, str]:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("只支持 http/https 链接")
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        resp = await client.get(url, headers={"User-Agent": "ragdesk/0.1"})
        resp.raise_for_status()
        content_type = (resp.headers.get("content-type") or "").lower()
        raw = resp.text
    if "html" in content_type or raw.lstrip().startswith("<"):
        parser = _TextExtractor()
        parser.feed(raw)
        title_match = re.search(r"<title[^>]*>(.*?)</title>", raw, re.I | re.S)
        title = (title_match.group(1).strip() if title_match else "") or parsed.netloc
        body = "\n".join(parser.parts)
        text = f"# {title}\n\n来源: {url}\n\n{body}".strip()
        filename = re.sub(r"[^\w\u4e00-\u9fff.-]+", "_", title)[:40] or "page"
        return f"{filename}.md", text
    name = parsed.path.rsplit("/", 1)[-1] or "page.txt"
    if "." not in name:
        name = f"{name}.txt"
    return name, raw
