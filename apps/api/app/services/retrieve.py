from app.models.schemas import Citation
from app.services.providers import get_provider
from app.services.vector_store import get_collection


async def retrieve(query: str, top_k: int = 4) -> list[Citation]:
    collection = get_collection()
    count = collection.count()
    if count == 0:
        return []

    provider = get_provider()
    [embedding] = await provider.embed([query])
    result = collection.query(
        query_embeddings=[embedding],
        n_results=min(top_k, count),
        include=["documents", "metadatas", "distances"],
    )

    docs = (result.get("documents") or [[]])[0]
    metas = (result.get("metadatas") or [[]])[0]
    distances = (result.get("distances") or [[]])[0]

    citations: list[Citation] = []
    for doc, meta, dist in zip(docs, metas, distances, strict=False):
        score = None
        if dist is not None:
            score = round(1 - float(dist), 4)
        citations.append(
            Citation(
                document_id=str(meta.get("document_id") or ""),
                filename=str(meta.get("filename") or "unknown"),
                excerpt=(doc or "")[:500],
                score=score,
            )
        )
    return citations
