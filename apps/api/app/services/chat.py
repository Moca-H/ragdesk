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
        loc = f"#{c.chunk_index}" if c.chunk_index is not None else ""
        blocks.append(f"[来源 {i}] 文件: {c.filename}{loc}\n{c.excerpt}")
    joined = "\n\n".join(blocks)
    return (
        "你是 ragdesk 文档问答助手。请仅依据下列检索片段回答，"
        "并在关键处用（来源 N）标注。若资料不足请明确说明。\n\n"
        f"{joined}"
    )


async def _rewrite_query(user_query: str) -> str:
    provider = get_provider()
    messages = [
        {
            "role": "system",
            "content": (
                "把用户问题改写成更适合文档检索的简短查询。"
                "只输出查询文本，不要解释。"
            ),
        },
        {"role": "user", "content": user_query},
    ]
    chunks: list[str] = []
    async for token in provider.stream_chat(messages):
        chunks.append(token)
    rewritten = "".join(chunks).strip().splitlines()[0].strip()
    return rewritten or user_query


async def stream_rag_answer(
    messages: list[ChatMessage],
    top_k: int = 4,
    *,
    mode: str = "rag",
) -> AsyncIterator[str]:
    user_query = next(
        (m.content for m in reversed(messages) if m.role == "user"),
        "",
    )

    search_query = user_query
    if mode == "agent":
        yield json.dumps(
            {"type": "stage", "stage": "rewrite", "detail": "正在改写检索问题"},
            ensure_ascii=False,
        )
        search_query = await _rewrite_query(user_query)
        yield json.dumps(
            {
                "type": "stage",
                "stage": "rewrite_done",
                "detail": search_query,
            },
            ensure_ascii=False,
        )

    yield json.dumps(
        {"type": "stage", "stage": "retrieve", "detail": "正在检索知识库"},
        ensure_ascii=False,
    )
    citations = await retrieve(search_query, top_k=top_k, hybrid=True)
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
