from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import TypeVar

logger = logging.getLogger("ragdesk")

T = TypeVar("T")


async def with_retry(
    fn: Callable[[], Awaitable[T]],
    *,
    attempts: int = 3,
    base_delay: float = 0.6,
    label: str = "operation",
) -> T:
    last: Exception | None = None
    for i in range(max(1, attempts)):
        try:
            return await fn()
        except Exception as exc:  # noqa: BLE001
            last = exc
            if i >= attempts - 1:
                break
            delay = base_delay * (2**i)
            logger.warning("%s failed (%s/%s): %s; retry in %.1fs", label, i + 1, attempts, exc, delay)
            await asyncio.sleep(delay)
    assert last is not None
    raise last
