from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.models.schemas import ChatRequest
from app.services.chat import stream_rag_answer

router = APIRouter(tags=["chat"])


@router.post("/api/chat")
async def chat(body: ChatRequest) -> StreamingResponse:
    async def event_gen():
        async for payload in stream_rag_answer(body.messages, top_k=body.top_k):
            yield f"data: {payload}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
