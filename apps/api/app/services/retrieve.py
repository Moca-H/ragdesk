import math
import re
from collections import Counter

from app.models.schemas import Citation
from app.services.providers import get_provider
from app.services.vector_store import get_collection


def _tokenize(text: str) -> list[str]:
    text = text.lower()
    words = re.findall(r"[a-z0-9_]+", text)
    chars = [c for c in text if "\u4e00" <= c <= "\u9fff"]
    # bigrams for Chinese
    bigrams = [chars[i] + chars[i + 1] for i in range(len(chars) - 1)]
    return words + chars + bigrams


def _bm25_scores(query: str, documents: list[str], k1: float = 1.5, b: float = 0.75) -> list[float]:
    tokenized = [_tokenize(d) for d in documents]
    q_terms = _tokenize(query)
    if not q_terms or not tokenized:
        return [0.0] * len(documents)

    df: Counter[str] = Counter()
    for toks in tokenized:
        for term in set(toks):
            df[term] += 1
    n = len(tokenized)
    avgdl = sum(len(t) for t in tokenized) / max(n, 1)
    scores: list[float] = []
    for toks in tokenized:
        tf = Counter(toks)
        dl = len(toks) or 1
        score = 0.0
        for term in q_terms:
            if term not in tf:
                continue
            n_q = df.get(term, 0)
            idf = math.log(1 + (n - n_q + 0.5) / (n_q + 0.5))
            freq = tf[term]
            score += idf * (freq * (k1 + 1)) / (freq + k1 * (1 - b + b * dl / avgdl))
        scores.append(score)
    return scores


async def retrieve(
    query: str,
    top_k: int = 4,
    *,
    hybrid: bool = True,
) -> list[Citation]:
    collection = get_collection()
    count = collection.count()
    if count == 0:
        return []

    provider = get_provider()
    [embedding] = await provider.embed([query])
    candidate_n = min(max(top_k * 4, top_k), count)
    result = collection.query(
        query_embeddings=[embedding],
        n_results=candidate_n,
        include=["documents", "metadatas", "distances"],
    )

    docs = (result.get("documents") or [[]])[0]
    metas = (result.get("metadatas") or [[]])[0]
    distances = (result.get("distances") or [[]])[0]

    vector_scores = [
        (1 - float(dist)) if dist is not None else 0.0 for dist in distances
    ]
    bm25 = _bm25_scores(query, list(docs)) if hybrid else [0.0] * len(docs)
    max_bm25 = max(bm25) if bm25 else 0.0
    norm_bm25 = [s / max_bm25 if max_bm25 > 0 else 0.0 for s in bm25]

    ranked = []
    for idx, (doc, meta, v_score, b_score) in enumerate(
        zip(docs, metas, vector_scores, norm_bm25, strict=False)
    ):
        score = 0.65 * v_score + 0.35 * b_score if hybrid else v_score
        ranked.append((score, idx, doc, meta))
    ranked.sort(key=lambda x: x[0], reverse=True)

    citations: list[Citation] = []
    for score, _, doc, meta in ranked[:top_k]:
        chunk_index = meta.get("chunk_index")
        citations.append(
            Citation(
                document_id=str(meta.get("document_id") or ""),
                filename=str(meta.get("filename") or "unknown"),
                excerpt=doc or "",
                score=round(float(score), 4),
                chunk_index=int(chunk_index) if chunk_index is not None else None,
            )
        )
    return citations
