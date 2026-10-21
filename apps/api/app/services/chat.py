import json
from collections.abc import AsyncIterator

from app.models.schemas import ChatMessage, Citation
from app.services.providers import get_provider
from app.services.retrieve import retrieve


def _build_system_prompt(citations: list[Citation]) -> str:
    if not citations:
        return (
            "你是 ragdesk 助手。当前知识库没有检索到相关片段。"
            "请如实说明资料不足，不要编造来源。"
        )
    blocks: list[str] = []
    for i, c in enumerate(citations, start=1):
        blocks.append(
            f"[来源 {i}] 文件: {c.filename}\n{c.excerpt}"
        )
    joined = "\n\n".join(blocks)
    return (
        "你是 ragdesk 文档问答助手。请仅依据下列检索片段回答，"
        "并在关键处用（来源 N）标注。若资料不足请明确说明。\n\n"
        f"{joined}"
    )


async def stream_rag_answer(
    messages: list[ChatMessage],
    top_k: int = 4,
) -> AsyncIterator[str]:
    """Yield SSE data lines (already JSON payloads as strings)."""
    user_query = next(
        (m.content for m in reversed(messages) if m.role == "user"),
        "",
    )
    citations = await retrieve(user_query, top_k=top_k)
    yield json.dumps(
        {"type": "citations", "citations": [c.model_dump() for c in citations]},
        ensure_ascii=False,
    )

    system = _build_system_prompt(citations)
    provider_messages: list[dict[str, str]] = [
        {"role": "system", "content": system}
    ]
    for m in messages:
        if m.role == "system":
            continue
        provider_messages.append({"role": m.role, "content": m.content})

    provider = get_provider()
    async for token in provider.stream_chat(provider_messages):
        yield json.dumps({"type": "token", "content": token}, ensure_ascii=False)

    yield json.dumps({"type": "done"}, ensure_ascii=False)
